// src/chat-agent.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ContentstackMCPClient } from './mcp-client.js';
import * as dotenv from 'dotenv';
// Add these imports at the top
import { AutoContentMapper } from './auto-content-mapper.js';



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
    provider: 'google' | 'openai' | 'anthropic'|'groq';
    apiKey?: string;
    model?: string;
    temperature?: number;
  };
}

// 🚀 CACHE SYSTEM FOR INSTANT RESPONSES
interface CacheItem {
  data: any;
  timestamp: number;
  expires: number;
}


class ResponseCache {
  private cache = new Map<string, CacheItem>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

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
  private isMCPInitialized: boolean = false;
  private cache: ResponseCache;
  private availableContentTypes: string[] = [];
  private lastContentTypeUpdate: number = 0;
// Add this property to the class
private contentMapper: AutoContentMapper | null = null;

  constructor(config: ChatAgentConfig = {}) {
    this.config = config;
    this.cache = new ResponseCache();
    
    const llmApiKey = config.llm?.apiKey || process.env.GOOGLE_API_KEY!;
    const llmModel = config.llm?.model || 'gemini-1.5-flash'; // Faster model
    const llmTemperature = config.llm?.temperature || 0.3;

    this.model = new ChatGoogleGenerativeAI({
      apiKey: llmApiKey,
      model: llmModel,
      temperature: llmTemperature,
    });

    // Initialize MCP client but don't connect yet
    if (config.contentstack?.apiKey) {
      this.mcpClient = new ContentstackMCPClient({
        apiKey: config.contentstack.apiKey,
        managementToken: config.contentstack.deliveryToken,
        environment: config.contentstack.environment,
        region: config.contentstack.region
      });
    }
  }

// Update the initialize method
async initialize(): Promise<void> {
  console.log('🤖 Initializing Chat Agent...');
  
  // Connect to MCP immediately during initialization
  if (this.mcpClient) {
    try {
      console.log('🔗 Connecting to MCP during initialization...');
      await this.mcpClient.connect();
      this.isMCPInitialized = true;
      console.log('✅ MCP connected successfully');

      // Initialize auto content mapper
      this.contentMapper = new AutoContentMapper(this.mcpClient);
      
      // Generate mapping only if needed
      if (this.contentMapper.shouldRefreshMapping()) {
        console.log('🔄 Generating content mapping...');
        await this.contentMapper.generateMapping();
      }
      
      // Pre-warm content types cache
      await this.getAvailableContentTypes(true);
      console.log('🔥 Caches warmed up successfully');
    } catch (error) {
      console.error('❌ MCP connection failed:', error);
      console.log('⚠️ MCP will not be available for this session');
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
        console.log('🔗 Connecting to MCP...');
        await this.mcpClient.connect();
        this.isMCPInitialized = true;
        console.log('✅ MCP connected successfully');
      } catch (error) {
        console.error('❌ MCP connection failed:', error);
        throw new Error('Failed to connect to MCP');
      }
    }
  }

  // 🚀 ULTRA-FAST INTENT DETECTION
  private needsContentAccess(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase().trim();
    
    // ⚡ INSTANT GENERAL CONVERSATION DETECTION
    const generalPatterns = [
      /^(hi|hello|hey|greetings|hola|bonjour|namaste|howdy|yo|sup|wassup|what's up)/i,
      /^(good\s+(morning|afternoon|evening|day))/i,
      /^(thanks|thank you|thx|ty|appreciate it|cheers)/i,
      /^(please|pls|plz|sorry|excuse me|pardon)/i,
      /^(bye|goodbye|see ya|see you|farewell|cya|adios)/i,
      /^(how are you|how're you|how do you do|what's new)/i,
      /^(who are you|what are you|what can you do|your name)/i,
      /^(help|support|assist|guide|instructions)/i,
      /^(yes|no|maybe|sure|ok|okay|alright|fine|cool)/i,
      /^(what is this|what's this|explain|tell me about)/i,
      /^(awesome|great|perfect|excellent|wonderful|nice)/i
    ];

    // Check for general patterns first (fastest path)
    if (generalPatterns.some(pattern => pattern.test(lowerMessage))) {
      return false;
    }

    // ⚡ CONTENT-RELATED KEYWORDS (OPTIMIZED)
    const contentKeywords = [
      'product', 'item', 'show', 'find', 'search', 'get', 'list',
      'price', 'cost', 'buy', 'purchase', 'shop', 'order',
      'detail', 'spec', 'feature', 'information', 'info',
      'image', 'photo', 'picture', 'file', 'asset',
      'collection', 'catalog', 'inventory', 'stock',
      'jewelry', 'jhumka', 'necklace', 'ring', 'bracelet', 'earring'
    ];

    return contentKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private isShowAllQuery(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    
    const showAllPatterns = [
      /^show\s+(all|every|everything|complete|full)/,
      /^display\s+(all|every|everything|complete|full)/,
      /^list\s+(all|every|everything|complete|full)/,
      /^what\s+(do you have|products|items|collection)/,
      /^(all|every|complete|full)\s+(products|items|collection)/,
      /^show\s+(me\s+)?your\s+(collection|products|items)/,
      /^what's\s+(in|available)\s+(your|the)\s+(collection|store)/,
      /^see\s+(all|everything|all items)/,
      /^browse\s+(all|everything|collection)/
    ];

    return showAllPatterns.some(pattern => pattern.test(lowerMessage));
  }

  private buildGeneralContext(history: ChatMessage[]): string {
    const lastFewMessages = history.slice(-3); // Reduced from 4 to 3
    
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

  private cleanResponse(response: any): string {
    let content: string;
    if (typeof response === 'string') {
      content = response;
    } else if (response && typeof response.content === 'string') {
      content = response.content;
    } else if (Array.isArray(response)) {
      content = response
        .map(item => {
          if (typeof item === 'string') return item;
          if (item && typeof item.text === 'string') return item.text;
          return '';
        })
        .filter(text => text.length > 0)
        .join(' ');
    } else {
      content = String(response);
    }

    return content
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

async sendMessage(userMessage: string, history: ChatMessage[] = []): Promise<string> {
  const startTime = Date.now();
  
  try {
      if (!history) history = [];
      history.push({ role: 'user', content: userMessage });
      this.conversationHistory = [...history];

      console.log(`👤 User: ${userMessage}`);

      // 🚀 ULTRA-FAST INTENT DETECTION
      const needsContent = this.needsContentAccess(userMessage);
      
      if (!needsContent) {
          console.log('💬 General conversation - using LLM only (no MCP)');
          const generalContext = this.buildGeneralContext(history);
          const response = await this.model.invoke(generalContext);
          const assistantResponse = this.cleanResponse(response);
          
          history.push({ role: 'assistant', content: assistantResponse });
          this.conversationHistory = [...history];
          
          console.log(`⚡ Response time: ${Date.now() - startTime}ms`);
          return assistantResponse;
      }

      // If MCP is not available, respond with a helpful message
      if (!this.mcpClient) {
        const noMCPResponse = "I can help with general questions, but content access is not configured. Please check your Contentstack settings.";
        history.push({ role: 'assistant', content: noMCPResponse });
        this.conversationHistory = [...history];
        return noMCPResponse;
      }

      console.log('🔍 Content-related query - checking cache first...');
      
      // 🚀 CACHE CHECK BEFORE MCP CONNECTION
      const cacheKey = `query:${userMessage.toLowerCase().trim()}`;
      const cachedResponse = this.cache.get(cacheKey);
      
      if (cachedResponse) {
          console.log('🎯 Cache hit - returning cached response');
          history.push({ role: 'assistant', content: cachedResponse });
          this.conversationHistory = [...history];
          
          console.log(`⚡ Response time: ${Date.now() - startTime}ms (CACHED)`);
          return cachedResponse;
      }

      console.log('🔍 Cache miss - ensuring MCP is connected...');
      await this.ensureMCPConnected();

      let relevantContent: string = '';
      let assistantResponse: string = '';

      // 🚀 ULTRA-FAST AUTO-MAPPER LOGIC
      if (this.contentMapper && Object.keys(this.contentMapper['mapping'].products).length > 0) {
          console.log('🔍 Using auto-mapper for ultra-fast search...');
          
          // Check for budget queries
          if (userMessage.toLowerCase().includes('budget')) {
              const affordableProducts = this.contentMapper.findProductsByBudget(userMessage);
              if (affordableProducts.length > 0) {
                  relevantContent = `Affordable products within your budget:\n${affordableProducts
                    .map(p => `• ${p.fields.title} - ${p.fields.price}`)
                    .join('\n')}`;
              } else {
                  relevantContent = 'No products found within your budget.';
              }
          } 
          // Check for show all queries
          else if (this.isShowAllQuery(userMessage)) {
              console.log('🔍 Show all collection requested');
              const allProducts = this.contentMapper.getAllProducts();
              if (allProducts.length === 0) {
                  assistantResponse = "I don't have any items in my collection yet.";
              } else {
                  relevantContent = `All available products:\n${allProducts
                    .map(p => `• ${p.fields.title} - ${p.fields.price}`)
                    .join('\n')}`;
              }
          }
          // Check for specific product queries
          else {
              const product = this.contentMapper.findProduct(userMessage);
              if (product) {
                  // Direct response from mapper (0ms latency!)
                  assistantResponse = this.contentMapper.generateResponse(product);
                  console.log('🎯 Auto-mapper direct hit!');
              }
          }

          // If we got a direct response from auto-mapper, use it
          if (assistantResponse) {
              this.cache.set(cacheKey, assistantResponse, 2 * 60 * 1000);
              history.push({ role: 'assistant', content: assistantResponse });
              this.conversationHistory = [...history];
              console.log(`⚡ Response time: ${Date.now() - startTime}ms (AUTO-MAPPER)`);
              return assistantResponse;
          }
      }

      // 🚀 FALLBACK TO MCP SEARCH (if auto-mapper didn't find it or is empty)
      if (!assistantResponse) {
          console.log('🔍 Auto-mapper missed, falling back to MCP search...');
          
          if (this.isShowAllQuery(userMessage)) {
              const availableContentTypes = await this.getAvailableContentTypes();
              if (availableContentTypes.length === 0) {
                  assistantResponse = "I don't have any items in my collection yet.";
              } else {
                  const allContent = await this.mcpClient!.searchContent(userMessage, availableContentTypes[0]);
                  const context = this.buildConversationContext(allContent, 'collection', history);
                  const response = await this.model.invoke(context);
                  assistantResponse = this.cleanResponse(response);
              }
          } else {
              const availableContentTypes = await this.getAvailableContentTypes();
              
              if (availableContentTypes.length === 0) {
                  relevantContent = 'No content types found in this stack.';
              } else {
                  const detectedContentType = this.findBestContentType(userMessage, availableContentTypes);
                  console.log(`🔍 Smart searching in "${detectedContentType}" content type...`);
                  
                  try {
                      relevantContent = await this.mcpClient!.searchContent(userMessage, detectedContentType);
                  } catch (error) {
                      console.error(`❌ Error searching in ${detectedContentType}:`, error);
                      relevantContent = await this.mcpClient!.searchContent(userMessage, availableContentTypes[0]);
                  }
              }

              const context = this.buildConversationContext(relevantContent, undefined, history);
              console.log('🤖 Generating response...');
              const response = await this.model.invoke(context);
              assistantResponse = this.cleanResponse(response);
          }
      }

      // Cache successful responses
      if (!assistantResponse.includes('Unable to') && !assistantResponse.includes('No content')) {
          this.cache.set(cacheKey, assistantResponse, 2 * 60 * 1000);
      }
      
      history.push({ role: 'assistant', content: assistantResponse });
      this.conversationHistory = [...history];

      if (history.length > 8) {
          history.splice(0, history.length - 8);
          this.conversationHistory = [...history];
      }

      console.log(`⚡ Response time: ${Date.now() - startTime}ms`);
      return assistantResponse;
  } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
      history.push({ role: 'assistant', content: errorMessage });
      this.conversationHistory = [...history];
      return errorMessage;
  }
}

// Update the getAvailableContentTypes method to fix the tool name
private async getAvailableContentTypes(forceRefresh: boolean = false): Promise<string[]> {
  // 🚀 CACHED CONTENT TYPES
  const now = Date.now();
  const cacheKey = 'content_types';
  
  if (!forceRefresh && this.availableContentTypes.length > 0 && 
      (now - this.lastContentTypeUpdate) < 5 * 60 * 1000) {
    return this.availableContentTypes;
  }

  try {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }
    
    // Ensure MCP is connected before making the call
    await this.ensureMCPConnected();
    
    // ✅ CORRECTED TOOL NAME: get_all_content_types (not get_all_content_typpes)
    const contentTypesResponse = await this.mcpClient.callTool('get_all_content_types', {});
    const contentTypesData = JSON.parse(contentTypesResponse);
    
    if (contentTypesData && Array.isArray(contentTypesData.content_types)) {
      this.availableContentTypes = contentTypesData.content_types
        .map((ct: any) => ct.uid)
        .filter(Boolean);
      
      this.lastContentTypeUpdate = now;
      return this.availableContentTypes;
    }
    
    return [];
  } catch (error) {
    console.error('❌ Error getting content types:', error);
    return this.availableContentTypes.length > 0 ? this.availableContentTypes : [];
  }
}

  private findBestContentType(query: string, availableTypes: string[]): string {
    if (availableTypes.length === 0) return 'page';
    if (availableTypes.length === 1) return availableTypes[0];
    
    const queryLower = query.toLowerCase();
    
    // 🚀 OPTIMIZED CONTENT TYPE MATCHING
    const typeScores: {[key: string]: number} = {};
    
    availableTypes.forEach(type => {
      typeScores[type] = 0;
      
      // Direct match
      if (queryLower.includes(type)) {
        typeScores[type] += 3;
      }
      
      // Common synonyms
      const synonyms: {[key: string]: string[]} = {
        product: ['item', 'goods', 'merchandise', 'product', 'collection'],
        blog: ['post', 'article', 'news', 'update', 'blog'],
        page: ['content', 'information', 'about', 'contact', 'page'],
        faq: ['question', 'answer', 'help', 'support', 'faq'],
        asset: ['image', 'file', 'picture', 'photo', 'asset']
      };
      
      Object.entries(synonyms).forEach(([mainType, words]) => {
        if (type === mainType) {
          words.forEach(word => {
            if (queryLower.includes(word)) {
              typeScores[type] += 2;
            }
          });
        }
      });
    });
    
    // Find best match
    let bestType = availableTypes[0];
    let bestScore = typeScores[availableTypes[0]];
    
    for (let i = 1; i < availableTypes.length; i++) {
      if (typeScores[availableTypes[i]] > bestScore) {
        bestScore = typeScores[availableTypes[i]];
        bestType = availableTypes[i];
      }
    }
    
    return bestType;
  }

  private buildConversationContext(contentstackData: string, queryType?: string, history: ChatMessage[] = []): string {
    const effectiveHistory = history.length > 0 ? history : this.conversationHistory;
    
    const historyContext = effectiveHistory
      .slice(-3) // Reduced context window
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    return `
You are a helpful AI assistant. Answer the user's question based on the content provided.

CONVERSATION HISTORY:
${historyContext}

CONTENT DATA:
${contentstackData}

CURRENT USER QUESTION: ${effectiveHistory[effectiveHistory.length - 1]?.content}

INSTRUCTIONS:
1. Answer based ONLY on the content provided
2. Be conversational and helpful
3. If you don't know the answer, say so
4. Keep responses concise but informative (under 100 words)
5. Maintain the conversation context
6. NEVER use markdown formatting
7. Always respond with plain, clean text only

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
      await this.mcpClient.disconnect();
    }
    console.log('🔌 Chat Agent shutdown');
  }
}