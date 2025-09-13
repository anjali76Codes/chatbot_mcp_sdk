// src/chat-agent.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ContentstackMCPClient } from './mcp-client.js';
import { AutoContentMapper } from './auto-content-mapper.js';
import * as dotenv from 'dotenv';

dotenv.config();

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatAgentConfig {
  contentstack?: {
    apiKey?: string;
    deliveryToken?: string;
    environment?: string;
    region?: string;
  };

  llm?: {
    provider: 'google' | 'openai' | 'anthropic' | 'groq';
    apiKey?: string;
    model?: string;
    temperature?: number;
  };
}

interface CacheItem {
  data: any;
  timestamp: number;
  expires: number;
}

class ResponseCache {
  private cache = new Map<string, CacheItem>();
  private defaultTTL = 5 * 60 * 1000;

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

export class ContentstackChatAgent {
  private model: ChatGoogleGenerativeAI;
  private mcpClient: ContentstackMCPClient | null = null;
  private conversationHistory: ChatMessage[] = [];
  private config: ChatAgentConfig;
  private isMCPInitialized = false;
  private cache: ResponseCache;
  private availableContentTypes: string[] = [];
  private lastContentTypeUpdate = 0;
  private contentMapper: AutoContentMapper | null = null;

  constructor(config: ChatAgentConfig = {}) {
    this.config = config;
    this.cache = new ResponseCache();

    const llmApiKey = config.llm?.apiKey || process.env.GOOGLE_API_KEY!;
    const llmModel = config.llm?.model || 'gemini-1.5-flash';
    const llmTemperature = config.llm?.temperature || 0.3;

    this.model = new ChatGoogleGenerativeAI({
      apiKey: llmApiKey,
      model: llmModel,
      temperature: llmTemperature
    });

    if (config.contentstack?.apiKey) {
      this.mcpClient = new ContentstackMCPClient({
        apiKey: config.contentstack.apiKey,
        managementToken: config.contentstack.deliveryToken,
        environment: config.contentstack.environment,
        region: config.contentstack.region
      });
    }
  }

  async initialize(): Promise<void> {
    console.log('🤖 Initializing Chat Agent...');
    if (this.mcpClient) {
      try {
        console.log('🔗 Connecting to MCP during initialization...');
        await this.mcpClient.connect();
        this.isMCPInitialized = true;
        console.log('✅ MCP connected successfully');

        this.contentMapper = new AutoContentMapper(this.mcpClient);

        if (this.contentMapper.shouldRefreshMapping()) {
          console.log('🔄 Generating content mapping...');
          await this.contentMapper.generateMapping();
        }

        await this.getAvailableContentTypes(true);
        console.log('🔥 Caches warmed up successfully');
      } catch (error) {
        console.error('❌ MCP connection failed:', error);
        this.mcpClient = null;
      }
    } else {
      console.log('ℹ️ No MCP client configured - running in LLM-only mode');
    }
    console.log('✅ Chat Agent ready!');
  }

  private async ensureMCPConnected(): Promise<void> {
    if (!this.isMCPInitialized && this.mcpClient) {
      try {
        await this.mcpClient.connect();
        this.isMCPInitialized = true;
      } catch (error) {
        throw new Error('Failed to connect to MCP');
      }
    }
  }

  // Smalltalk detection: if it's clearly a greeting/thanks/etc, we avoid content routing
  private isSmallTalk(message: string): boolean {
    const lower = message.toLowerCase();
    const generalPatterns = [
      /^(hi|hello|hey|greetings|hola|bonjour|namaste|howdy|yo)/i,
      /^(thanks|thank you|thx|cheers)/i,
      /^(bye|goodbye|see ya|farewell)/i,
      /^(how are you|what's up|what are you|who are you)/i,
      /^(help|support|guide|instructions)/i
    ];
    return generalPatterns.some(p => p.test(lower));
  }

//   private buildGeneralContext(history: ChatMessage[]): string {
//     const lastFewMessages = history.slice(-3);
//     const historyContext = lastFewMessages
//       .map(m => `${m.role.toUpperCase()}: ${m.content}`)
//       .join('\n');

//     return `
// You are a friendly AI assistant. Keep responses short and conversational.

// CONVERSATION HISTORY:
// ${historyContext}

// INSTRUCTIONS:
// - Respond naturally
// - Max 2 sentences, under 50 words
// - No markdown
// YOUR RESPONSE:`.trim();
//   }

  private cleanResponse(response: any): string {
    let content: string;
    if (typeof response === 'string') content = response;
    else if (response && typeof response.content === 'string') content = response.content;
    else if (Array.isArray(response)) {
      content = response
        .map(item => (typeof item === 'string' ? item : item?.text || ''))
        .join(' ');
    } else content = String(response);

    return content.replace(/\*\*|\*|_|`/g, '').trim();
  }

  /**
   * Find the best content type for a query.
   * Returns the matched content type uid, or null if uncertain.
   */
  private findBestContentType(query: string, availableTypes: string[]): string | null {
    if (!availableTypes || availableTypes.length === 0) return null;
    const q = query.toLowerCase();

    // 1) Try dynamic mapper (high confidence)
    if (this.contentMapper) {
      try {
        for (const [ct, keywords] of Object.entries(this.contentMapper['mapping'] || {})) {
          if (!keywords || keywords.length === 0) continue;
          for (const kw of keywords) {
            if (!kw) continue;
            // match whole words or substrings
            const normalized = kw.toLowerCase();
            if (q.includes(normalized)) {
              // ensure the matched content type is actually available
              if (availableTypes.includes(ct)) {
                console.log(`🎯 Mapper matched "${ct}" for token "${kw}"`);
                return ct;
              }
            }
          }
        }
      } catch (err) {
        // If mapper is present but fails, swallow and continue to heuristics
        console.warn('⚠️ Mapper lookup failed, falling back to heuristics', err);
      }
    }

    // 2) Heuristics - common indicators
    const productIndicators = ['price', 'cost', 'buy', 'purchase', 'how much', 'rate', 'mrp', '₹', 'rs', 'amount', 'discount'];
    const policyIndicators = ['return', 'refund', 'shipping', 'delivery', 'policy', 'exchange', 'return policy', 'refund policy'];
    const faqIndicators = ['how', 'what', 'why', 'when', 'can i', 'do i', 'is it', 'are there', 'help', 'support'];

    // Prefer explicit product type if indicators present
    if (productIndicators.some(i => q.includes(i))) {
      const prod = availableTypes.find(t => t.toLowerCase().includes('product') || t.toLowerCase().includes('products') || t.toLowerCase().includes('item'));
      if (prod) {
        console.log('🔎 Heuristic: product indicator matched');
        return prod;
      }
    }

    if (policyIndicators.some(i => q.includes(i))) {
      const policy = availableTypes.find(t => {
        const lower = t.toLowerCase();
        return lower.includes('ship') || lower.includes('policy') || lower.includes('return') || lower.includes('refund') || lower.includes('shipping');
      });
      if (policy) {
        console.log('🔎 Heuristic: policy indicator matched');
        return policy;
      }
    }

    if (faqIndicators.some(i => q.startsWith(i) || q.includes(`${i} `))) {
      const faq = availableTypes.find(t => t.toLowerCase().includes('faq') || t.toLowerCase().includes('faqs') || t.toLowerCase().includes('question'));
      if (faq) {
        console.log('🔎 Heuristic: faq indicator matched');
        return faq;
      }
    }

    // 3) No confident match — return null so caller can attempt safe fallbacks
    return null;
  }

  private async getAvailableContentTypes(forceRefresh = false): Promise<string[]> {
    const now = Date.now();
    if (!forceRefresh && this.availableContentTypes.length > 0 && now - this.lastContentTypeUpdate < 5 * 60 * 1000) {
      return this.availableContentTypes;
    }
    if (!this.mcpClient) return [];
    await this.ensureMCPConnected();
    try {
      const cts = await this.mcpClient.getContentTypes();
      this.availableContentTypes = cts;
      this.lastContentTypeUpdate = now;
      return cts;
    } catch (err) {
      console.warn('⚠️ getAvailableContentTypes failed:', err);
      return this.availableContentTypes;
    }
  }

  private buildConversationContext(data: string, queryType?: string, history: ChatMessage[] = []): string {
    const historyContext = history.slice(-3).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    return `
You are an AI assistant. Answer based only on the content provided.

HISTORY:
${historyContext}

CONTENT (${queryType || 'unknown'}):
${data}

QUESTION: ${history[history.length - 1]?.content || ''}

RULES:
- If answer not in content, say so
- Be concise, <100 words
- No markdown`.trim();
  }

  async sendMessage(userMessage: string, history: ChatMessage[] = []): Promise<string> {
    const start = Date.now();
    try {
      if (!history) history = [];
      history.push({ role: 'user', content: userMessage });
      this.conversationHistory = [...history];

      console.log(`👤 User: ${userMessage}`);

      // smalltalk check first
      if (this.isSmallTalk(userMessage)) {
        console.log('💬 General conversation (smalltalk)');
        const generalContext = this.buildGeneralContext(history);
        const response = await this.model.invoke(generalContext);
        const assistantResponse = this.cleanResponse(response);
        history.push({ role: 'assistant', content: assistantResponse });
        this.conversationHistory = [...history];
        console.log(`⚡ Response time: ${Date.now() - start}ms`);
        return assistantResponse;
      }

      // Content related
      if (!this.mcpClient) {
        const fallback = "I can help with general questions, but content access is not configured.";
        history.push({ role: 'assistant', content: fallback });
        this.conversationHistory = [...history];
        return fallback;
      }

      // Cache key
      const cacheKey = `query:${userMessage.toLowerCase().trim()}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('🎯 Cache hit');
        history.push({ role: 'assistant', content: cached });
        this.conversationHistory = [...history];
        return cached;
      }

      await this.ensureMCPConnected();

      // 1) get available content types
      const availableTypes = await this.getAvailableContentTypes();

      // 2) attempt smart detection (mapper + heuristics)
      let detectedType = this.findBestContentType(userMessage, availableTypes);
      if (detectedType) {
        console.log(`📦 Content-related query → initial matched type: ${detectedType}`);
      } else {
        console.log('📦 Content-related query → no confident match from mapper/heuristics');
      }

      // 3) If we have a detected type, try searching it first
      let results: any[] = [];
      if (detectedType) {
        try {
          results = await this.mcpClient.searchContent(userMessage, detectedType);
        } catch (err) {
          console.warn(`⚠️ searchContent failed for ${detectedType}:`, err);
          results = [];
        }
      }

      // 4) If no results from detected type (or no detected type), fallback to searching across all content types
      if (!results || results.length === 0) {
        console.log('🔄 Fallback: searching across all available content types...');
        const searchPromises = availableTypes.map(async (ct) => {
          try {
            const r = await this.mcpClient!.searchContent(userMessage, ct);
            return { ct, results: Array.isArray(r) ? r : (r && (r as any).entries) || [] };
          } catch (err) {
            return { ct, results: [] };
          }
        });

        const allResults = await Promise.all(searchPromises);

        // pick the content type with the largest number of results
        let best = { ct: null as string | null, results: [] as any[] };
        for (const item of allResults) {
          if (item.results && item.results.length > (best.results.length || 0)) {
            best = { ct: item.ct, results: item.results };
          }
        }

        if (best.ct) {
          detectedType = best.ct;
          results = best.results;
          console.log(`🔎 Fallback selected type: ${detectedType} (results: ${results.length})`);
        }
      }

      // 5) Prepare response
      let assistantResponse = '';
      if (!results || results.length === 0) {
        assistantResponse = "I don't have content or information about that.";
      } else {
        // build context and ask LLM to summarize/generate answer based on content
        const context = this.buildConversationContext(JSON.stringify(results), detectedType || 'unknown', history);
        const response = await this.model.invoke(context);
        assistantResponse = this.cleanResponse(response);
      }

      // Cache only successful informative responses
      if (assistantResponse && !assistantResponse.includes('I don\'t have content')) {
        this.cache.set(cacheKey, assistantResponse, 2 * 60 * 1000);
      }

      history.push({ role: 'assistant', content: assistantResponse });
      // keep last 8 messages
      if (history.length > 8) history.splice(0, history.length - 8);
      this.conversationHistory = [...history];

      console.log(`⚡ Response time: ${Date.now() - start}ms`);
      return assistantResponse;
    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      const errMsg = 'Sorry, I encountered an error. Please try again.';
      history.push({ role: 'assistant', content: errMsg });
      this.conversationHistory = [...history];
      return errMsg;
    }
  }

  private buildGeneralContext(history: ChatMessage[]): string {
    const lastFewMessages = history.slice(-3);
    const historyContext = lastFewMessages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    return `
You are a friendly and helpful AI assistant. Keep responses brief and conversational.

CONVERSATION HISTORY:
${historyContext}

INSTRUCTIONS:
1. Respond naturally to general conversation
2. Keep responses under 2 sentences
3. Be friendly and engaging
4. If asked about your capabilities, mention you can help find content and answer questions
5. NEVER use markdown formatting
6. Always respond with plain, clean text only
7. Response must be under 50 words

YOUR RESPONSE:`.trim();
  }

  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  clearConversationHistory(): void {
    this.conversationHistory = [];
    this.cache.clear();
    console.log('🗑️ Conversation history and cache cleared');
  }

  async shutdown(): Promise<void> {
    if (this.mcpClient && this.isMCPInitialized) {
      // call disconnect only if the client exposes it
      const maybeDisconnect = (this.mcpClient as any).disconnect;
      if (typeof maybeDisconnect === 'function') {
        await maybeDisconnect.call(this.mcpClient);
      } else {
        console.log('🔌 MCP client has no disconnect method - skipping');
      }
    }
    console.log('🔌 Chat Agent shutdown');
  }
}







// src/auto-content-mapper.ts
import { ContentstackMCPClient } from './mcp-client.js';

interface ContentMapping {
  [key: string]: string[]; // contentType -> synonyms
}

export class AutoContentMapper {
  private mcpClient: ContentstackMCPClient;
  private mapping: ContentMapping = {};
  private lastUpdated: number = 0;

  constructor(mcpClient: ContentstackMCPClient) {
    this.mcpClient = mcpClient;
  }

  shouldRefreshMapping(): boolean {
    const FIVE_MINUTES = 5 * 60 * 1000;
    return Date.now() - this.lastUpdated > FIVE_MINUTES || Object.keys(this.mapping).length === 0;
  }

  async generateMapping(): Promise<void> {
    try {
      const contentTypes = await this.mcpClient.getContentTypes();
      const newMapping: ContentMapping = {};

      for (const type of contentTypes) {
        newMapping[type] = this.generateSynonyms(type);
      }

      this.mapping = newMapping;
      this.lastUpdated = Date.now();
      console.log('✅ Content mapping generated:', this.mapping);
    } catch (err) {
      console.error('❌ Failed to generate mapping:', err);
    }
  }

  private generateSynonyms(contentType: string): string[] {
    const base = contentType.toLowerCase();
    const synonyms = [base];

    // crude pluralization
    if (!base.endsWith('s')) synonyms.push(base + 's');
    if (base.endsWith('y')) synonyms.push(base.slice(0, -1) + 'ies');

    // some useful generic synonyms
    if (base.includes('product')) synonyms.push('item', 'catalog', 'inventory', 'collection');
    if (base.includes('blog')) synonyms.push('article', 'post', 'story', 'news');
    if (base.includes('asset')) synonyms.push('image', 'photo', 'picture', 'file');
    if (base.includes('page')) synonyms.push('screen', 'view', 'document');
    if (base.includes('category')) synonyms.push('type', 'group', 'section');

    return synonyms;
  }

  async mapQueryToContentType(query: string): Promise<string | null> {
    if (this.shouldRefreshMapping()) {
      await this.generateMapping();
    }

    const lowerQuery = query.toLowerCase();
    for (const [contentType, synonyms] of Object.entries(this.mapping)) {
      for (const synonym of synonyms) {
        if (lowerQuery.includes(synonym)) {
          return contentType;
        }
      }
    }

    return null;
  }
}






// src/mcp-client.ts
import fetch from 'node-fetch';

interface MCPConfig {
  apiKey: string;
  managementToken?: string;
  environment?: string;
  region?: string;
}

interface ContentTypeResponse {
  content_types: { uid: string }[];
}

interface EntriesResponse {
  entries: any[];
}

export class ContentstackMCPClient {
  private config: MCPConfig;
  private baseUrl: string;

  constructor(config: MCPConfig) {
    this.config = config;
    this.baseUrl = this.getBaseUrl(config.region || 'us');
  }

  private getBaseUrl(region: string): string {
    switch (region.toLowerCase()) {
      case 'eu': return 'https://eu-api.contentstack.com/v3';
      case 'azure-na': return 'https://azure-na-api.contentstack.com/v3';
      case 'azure-eu': return 'https://azure-eu-api.contentstack.com/v3';
      default: return 'https://api.contentstack.io/v3';
    }
  }

  async connect(): Promise<void> {
    console.log('🔗 MCP client initialized');
  }

  async getContentTypes(): Promise<string[]> {
    const url = `${this.baseUrl}/content_types`;
    const res = await fetch(url, {
      headers: {
        api_key: this.config.apiKey,
        authorization: this.config.managementToken || ''
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch content types: ${res.status}`);
    }

    const data = (await res.json()) as ContentTypeResponse;
    return (data.content_types || []).map(ct => ct.uid);
  }

  async searchContent(query: string, contentType: string): Promise<any[]> {
    const url = `${this.baseUrl}/content_types/${contentType}/entries?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        api_key: this.config.apiKey,
        authorization: this.config.managementToken || ''
      }
    });

    if (!res.ok) {
      console.error(`❌ Failed to search ${contentType}: ${res.status}`);
      return [];
    }

    const data = (await res.json()) as EntriesResponse;
    return data.entries || [];
  }


  // inside ContentstackMCPClient class
async disconnect(): Promise<void> {
  console.log('🔌 MCP client disconnected');
}

}
