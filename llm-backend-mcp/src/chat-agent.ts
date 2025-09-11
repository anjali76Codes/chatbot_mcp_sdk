// src/chat-agent.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ContentstackMCPClient } from './mcp-client.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

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
    provider: 'google' | 'openai' | 'anthropic';
    apiKey?: string;
    model?: string;
    temperature?: number;
  };
  
  cache?: {
    enabled?: boolean;
    filePath?: string;
    prewarmQueries?: string[];
  };
}

interface ResponseCacheEntry {
  response: string;
  timestamp: number;
}

interface ContentCacheEntry {
  id: string;
  content: string;
  contentType: string;
  metadata: Record<string, any>;
  timestamp: number;
}

export class ContentstackChatAgent {
  private model: ChatGoogleGenerativeAI;
  private mcpClient: ContentstackMCPClient;
  private conversationHistory: ChatMessage[] = [];
  private generalPatterns: RegExp[];
  private config: ChatAgentConfig;
  private responseCache: Map<string, ResponseCacheEntry> = new Map();
  private contentCache: Map<string, ContentCacheEntry> = new Map();
  private cacheTTL = 2 * 60 * 1000; // 2 minutes
private contentCacheTTL = 24 * 60 * 60 * 1000;// 24 hours for content cache
  private cacheFilePath: string;
  private cacheEnabled: boolean;


  
  constructor(config: ChatAgentConfig = {}) {
    this.config = config;
    
    const llmApiKey = config.llm?.apiKey || process.env.GOOGLE_API_KEY!;
    const llmModel = config.llm?.model || 'gemini-1.5-flash';
    const llmTemperature = config.llm?.temperature || 0.3;

    this.model = new ChatGoogleGenerativeAI({
      apiKey: llmApiKey,
      model: llmModel,
      temperature: llmTemperature,
    });

    this.mcpClient = new ContentstackMCPClient({
      apiKey: config.contentstack?.apiKey,
      managementToken: config.contentstack?.deliveryToken,
      environment: config.contentstack?.environment,
      region: config.contentstack?.region
    });
    
    this.generalPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/i,
      /^(how are you|how's it going|what's up)/i,
      /^(thanks|thank you|appreciate it|cheers)/i,
      /^(who are you|what can you do|what are you|your name)/i,
      /^(please|sorry|excuse me)/i,
      /^(bye|goodbye|see you|exit|quit)/i,
      /^(help|support|what help can you provide)/i,
      /^(what is this|what is contentstack)/i
    ];

    // Cache configuration
    this.cacheEnabled = config.cache?.enabled ?? true;
    this.cacheFilePath = config.cache?.filePath || './content-cache.json';
  }

  async initialize(): Promise<void> {
    console.log('🤖 Initializing Chat Agent...');
    await this.mcpClient.connect();
    
    // Load content cache if enabled
    if (this.cacheEnabled) {
      await this.loadContentCache();
      
      // Pre-warm common queries if specified
      if (this.config.cache?.prewarmQueries?.length) {
        await this.prewarmCommonQueries(this.config.cache.prewarmQueries);
      }
    }
    
    console.log('✅ Chat Agent ready!');
  }

  private async loadContentCache(): Promise<void> {
    try {
      const cacheDir = path.dirname(this.cacheFilePath);
      try {
        await fs.access(cacheDir);
      } catch {
        await fs.mkdir(cacheDir, { recursive: true });
      }

      try {
        const data = await fs.readFile(this.cacheFilePath, 'utf-8');
        const cacheData = JSON.parse(data);
        
        if (cacheData.entries && Array.isArray(cacheData.entries)) {
          for (const entry of cacheData.entries) {
            if (entry.id && entry.content && Date.now() - (entry.timestamp || 0) < this.contentCacheTTL) {
              this.contentCache.set(entry.id, entry);
            }
          }
          console.log(`📦 Loaded ${this.contentCache.size} cached content entries`);
        }
      } catch (error) {
        console.log('No existing content cache found, starting fresh');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load content cache:', error);
    }
  }

  private async saveContentCache(): Promise<void> {
    if (!this.cacheEnabled) return;

    try {
      const entries = Array.from(this.contentCache.values()).filter(
        entry => Date.now() - entry.timestamp < this.contentCacheTTL
      );

      const cacheData = {
        timestamp: Date.now(),
        entries
      };

      await fs.writeFile(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn('⚠️ Failed to save content cache:', error);
    }
  }

  private generateContentId(query: string, contentType: string): string {
    return `${contentType}:${query.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`;
  }

// Check if the cache is actually being hit on subsequent requests
private async getCachedContent(query: string, contentType: string): Promise<string | null> {
    const contentId = this.generateContentId(query, contentType);
    console.log('🔍 Looking for cache key:', contentId); // ADD THIS
    console.log('📦 Available cache keys:', Array.from(this.contentCache.keys())); // ADD THIS
    
    const cached = this.contentCache.get(contentId);
    
    if (cached) {
        console.log('✅ Cache found, freshness check:', Date.now() - cached.timestamp, 'ms old'); // ADD THIS
    }
    
    if (cached && Date.now() - cached.timestamp < this.contentCacheTTL) {
        console.log('⚡ Cache HIT!'); // ADD THIS
        return cached.content;
    }
    
    console.log('❌ Cache MISS or expired'); // ADD THIS
    return null;
}

private async cacheContent(query: string, contentType: string, content: string): Promise<void> {
    const contentId = this.generateContentId(query, contentType);
    console.log('💾 Saving to cache with key:', contentId); // ADD THIS
    
    const cacheEntry: ContentCacheEntry = {
        id: contentId,
        content,
        contentType,
        metadata: { query, timestamp: Date.now() },
        timestamp: Date.now()
    };
    
    this.contentCache.set(contentId, cacheEntry);
    console.log('✅ Cache saved. Total entries:', this.contentCache.size); // ADD THIS
    
    // Periodically persist to disk
    if (this.contentCache.size % 10 === 0) {
        console.log('💿 Persisting cache to disk...'); // ADD THIS
        await this.saveContentCache();
    }
}

  private isShowAllQuery(message: string): boolean {
    const showAllPatterns = [
      /^show\s+(me\s+)?(all|every|complete|full)(\s+products?|\s+items?|\s+collection)?$/i,
      /^display\s+(all|every|complete|full)(\s+products?|\s+items?|\s+collection)?$/i,
      /^list\s+(all|every|complete|full)(\s+products?|\s+items?|\s+collection)?$/i,
      /^what\s+(do\s+you\s+have|products?|items?|collection)$/i,
      /^(all|every|complete|full)\s+(products?|items?|collection)$/i,
      /^show\s+your\s+collection$/i,
      /^show\s+me\s+your\s+products$/i,
      /^what's\s+in\s+(your|the)\s+collection$/i,
      /^show\s+me\s+everything$/i,
      /^all\s+products$/i,
      /^complete\s+catalog$/i,
      /^full\s+collection$/i
    ];
    
    const cleanedMessage = message.toLowerCase().trim();
    return showAllPatterns.some(pattern => pattern.test(cleanedMessage));
  }

  private getInstantGeneralResponse(message: string): string | null {
    const cleaned = message.toLowerCase().trim();
    
    const instantResponses: {pattern: RegExp, response: string}[] = [
      {pattern: /^(hi|hello|hey|greetings)/i, response: "Hello! 👋 How can I help you today?"},
      {pattern: /^(good morning)/i, response: "Good morning! ☀️ How can I assist you?"},
      {pattern: /^(good afternoon)/i, response: "Good afternoon! 🌤️ What can I help you with?"},
      {pattern: /^(good evening)/i, response: "Good evening! 🌙 How can I assist you?"},
      {pattern: /^(how are you|how's it going|what's up)/i, response: "I'm doing great, thanks for asking! 😊 How can I help you today?"},
      {pattern: /^(thanks|thank you|appreciate it|cheers)/i, response: "You're welcome! 😊 Is there anything else I can help you with?"},
      {pattern: /^(who are you|what can you do|what are you)/i, response: "I'm an AI assistant! I can help you find content and answer questions. What would you like to know?"},
      {pattern: /^(your name)/i, response: "I'm your AI Assistant! 🤖 How can I help you today?"},
      {pattern: /^(bye|goodbye|see you|exit|quit)/i, response: "Goodbye! 👋 Feel free to come back if you have more questions!"},
      {pattern: /^(help|support)/i, response: "I can help you find content and answer questions. What would you like to know?"},
      {pattern: /^(what is this)/i, response: "I'm here to help you find information from our content. How can I assist you?"}
    ];

    for (const {pattern, response} of instantResponses) {
      if (pattern.test(cleaned)) {
        return response;
      }
    }
    
    return null;
  }

  private fastContentTypeDetection(userQuery: string): string {
    const query = userQuery.toLowerCase();
    
    if (query.includes('asset') || query.includes('image') || query.includes('file')) return 'asset';
    if (query.includes('content type') || query.includes('content-type')) return 'content_type';
    
    return 'page';
  }

  private isGeneralMessage(message: string): boolean {
    const cleaned = message.toLowerCase().trim();
    
    const generalPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|good night)/i,
      /^(bye|goodbye|see you|see ya|farewell|exit|quit)/i,
      /^(thanks|thank you|thx|ty|appreciate it|cheers|much obliged)/i,
      /^(awesome|great|perfect|excellent|wonderful|fantastic|nice|cool)/i,
      /^(who are you|what can you do|what are you|your name|who made you)/i,
      /^(what is your purpose|what do you do|how do you work)/i,
      /^(please|sorry|excuse me|pardon me|my apologies)/i,
      /^(ok|okay|alright|sure|yes|no|maybe|perhaps)/i,
      /^(how are you|how's it going|what's up|how do you do)/i,
      /^(what's new|how's your day|how are things)/i,
      /^(help|support|can you help|need help|what help can you provide)/i,
      /^(what is this|what is contentstack|what is this chat|what is this bot)/i,
      /^(got it|understood|roger that|copy that|noted)/i,
      /^(that's all|that's it|no more questions|I'm done)/i,
      /^(wow|amazing|interesting|funny|haha|lol|lmao)/i,
      /^(oh|ah|uh|well|hmm|hm|interesting)/i
    ];

    const words = cleaned.split(/\s+/).filter(word => word.length > 0);
    const isVeryShort = words.length <= 3;
    
    const searchTerms = ['what', 'where', 'when', 'why', 'how', 'which', 'who', 'show', 'find', 'search', 'price', 'cost'];
    const hasSearchTerms = searchTerms.some(term => cleaned.includes(term));
    
    return generalPatterns.some(pattern => pattern.test(cleaned)) || 
           (isVeryShort && !hasSearchTerms);
  }

  private buildGeneralContext(history: ChatMessage[]): string {
    const lastFewMessages = history.slice(-4);
    
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
5. NEVER use markdown formatting like **bold** or _italic_ text
6. Always respond with plain, clean text only

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

  private generateCacheKey(userMessage: string, history: ChatMessage[]): string {
    const recentHistory = history.slice(-3).map(msg => msg.content).join('|');
    return `${userMessage}|${recentHistory}`;
  }

  private isConversationalMessage(message: string): boolean {
    const conversationalPatterns = [
      /^(hi|hello|hey|thanks|thank you|please|sorry)/i,
      /^(how are you|what's up|good morning|good afternoon|good evening)/i
    ];
    
    return conversationalPatterns.some(pattern => pattern.test(message));
  }

  // Update the relevant parts of the sendMessage method:

async sendMessage(userMessage: string, history: ChatMessage[] = []): Promise<string> {
    try {
        if (!history) {
            history = [];
        }

        // Check response cache first
        const cacheKey = this.generateCacheKey(userMessage, history);
        const cached = this.responseCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            console.log('⚡ Response cache hit');
            return cached.response;
        }

        history.push({ role: 'user', content: userMessage });
        this.conversationHistory = [...history];

        console.log(`👤 User: ${userMessage}`);

        const instantResponse = this.getInstantGeneralResponse(userMessage);
        if (instantResponse) {
            console.log('⚡ Ultra-fast general response');
            history.push({ role: 'assistant', content: instantResponse });
            this.conversationHistory = [...history];
            return instantResponse;
        }

        if (this.isShowAllQuery(userMessage)) {
            console.log('🔍 Show all collection requested');
            const availableContentTypes = await this.getAvailableContentTypes();
            
            if (availableContentTypes.length === 0) {
                const noItemsResponse = "I don't have any items in my collection yet.";
                history.push({ role: 'assistant', content: noItemsResponse });
                this.conversationHistory = [...history];
                return noItemsResponse;
            }
            
            // Check content cache first for show all queries
            const cacheKey = `show-all:${availableContentTypes[0]}`;
            const cachedContent = await this.getCachedContent(cacheKey, 'collection');
            let allContent: string;
            
            if (cachedContent) {
                allContent = cachedContent;
            } else {
                allContent = await this.mcpClient.searchContent(userMessage, availableContentTypes[0]);
                await this.cacheContent(cacheKey, 'collection', allContent);
            }
            
            const context = this.buildConversationContext(allContent, 'collection', history);
            const response = await this.model.invoke(context);
            const assistantResponse = this.cleanResponse(response);
            
            history.push({ role: 'assistant', content: assistantResponse });
            this.conversationHistory = [...history];
            
            if (!this.isConversationalMessage(userMessage)) {
                this.responseCache.set(cacheKey, {
                    response: assistantResponse,
                    timestamp: Date.now()
                });
            }
            
            return assistantResponse;
        }

        if (this.isGeneralMessage(userMessage)) {
            console.log('💬 General chat - using fast path');
            const generalContext = this.buildGeneralContext(history);
            const response = await this.model.invoke(generalContext);
            const assistantResponse = this.cleanResponse(response);
            history.push({ role: 'assistant', content: assistantResponse });
            this.conversationHistory = [...history];
            return assistantResponse;
        }

        console.log('🔍 Using MCP search...');
        let relevantContent: string = '';
        let queryType: string | undefined;
        const cleaned = userMessage.toLowerCase().trim();

        try {
            if (cleaned.includes('asset') || cleaned.includes('image') || cleaned.includes('file')) {
                console.log('🔍 Searching for assets...');
                queryType = 'assets';
                
                // Check cache first for assets
                const cachedAssets = await this.getCachedContent(userMessage, 'assets');
                if (cachedAssets) {
                    relevantContent = cachedAssets;
                } else {
                    try {
                        const environments = await this.mcpClient.callTool('get_all_environments', {});
                        const envData = JSON.parse(environments);
                        const availableEnv = envData.environments?.[0]?.name ?? 'production';
                        relevantContent = await this.mcpClient.callTool('get_all_assets', {
                            environment: availableEnv,
                            limit: 10,
                            skip: 0
                        });
                        await this.cacheContent(userMessage, 'assets', relevantContent);
                    } catch (error) {
                        console.error('Error getting assets:', error);
                        const environment = process.env.CONTENTSTACK_ENVIRONMENT || 'production';
                        relevantContent = await this.mcpClient.callTool('get_all_assets', {
                            environment,
                            limit: 10,
                            skip: 0
                        });
                        await this.cacheContent(userMessage, 'assets', relevantContent);
                    }
                }
            } else if (cleaned.includes('content type') || cleaned.includes('content-type')) {
                console.log('🔍 Getting content types...');
                queryType = 'content_types';
                
                // Check cache for content types
                const cachedContentTypes = await this.getCachedContent(userMessage, 'content_types');
                if (cachedContentTypes) {
                    relevantContent = cachedContentTypes;
                } else {
                    relevantContent = await this.mcpClient.callTool('get_all_content_types', {});
                    await this.cacheContent(userMessage, 'content_types', relevantContent);
                }
            } else {
                console.log('🔍 Determining content type...');
                
                const availableContentTypes = await this.getAvailableContentTypes();
                
                if (availableContentTypes.length === 0) {
                    console.log('⚠️ No content types available');
                    relevantContent = 'No content types found in this stack.';
                } else {
                    const detectedContentType = this.findBestContentType(userMessage, availableContentTypes);
                    console.log(`🔍 Smart searching in "${detectedContentType}" content type...`);
                    
                    // Check content cache first
                    const cachedContent = await this.getCachedContent(userMessage, detectedContentType);
                    
                    if (cachedContent) {
                        relevantContent = cachedContent;
                    } else {
                        try {
                            relevantContent = await this.mcpClient.searchContent(userMessage, detectedContentType);
                            await this.cacheContent(userMessage, detectedContentType, relevantContent);
                        } catch (error) {
                            console.error(`❌ Error searching in ${detectedContentType}:`, error);
                            relevantContent = await this.mcpClient.searchContent(userMessage, availableContentTypes[0]);
                            await this.cacheContent(userMessage, availableContentTypes[0], relevantContent);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error during content search:', error);
            relevantContent = 'Unable to search content at this time. Please try again.';
        }


      // Improved fallback handling
      if (!relevantContent || relevantContent === 'No content types found in this stack.') {
        console.log('⚠️ No content found, using fallback search...');
        
        const availableTypes = await this.getAvailableContentTypes();
        if (availableTypes.length > 0) {
          try {
            relevantContent = await this.mcpClient.searchContent(userMessage, availableTypes[0]);
            await this.cacheContent(userMessage, availableTypes[0], relevantContent);
          } catch (error) {
            console.error('❌ Error in fallback search:', error);
            relevantContent = 'No content available in this stack.';
          }
        } else {
          relevantContent = 'No content available in this stack.';
        }
      }

      const context = this.buildConversationContext(relevantContent, queryType, history);
      console.log('🤖 Generating response...');
      const response = await this.model.invoke(context);
      const assistantResponse = this.cleanResponse(response);
      history.push({ role: 'assistant', content: assistantResponse });
      this.conversationHistory = [...history];

      if (!this.isConversationalMessage(userMessage)) {
        this.responseCache.set(cacheKey, {
          response: assistantResponse,
          timestamp: Date.now()
        });
      }

      if (history.length > 10) {
        history.splice(0, history.length - 10);
        this.conversationHistory = [...history];
      }

      return assistantResponse;
    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
      history.push({ role: 'assistant', content: errorMessage });
      this.conversationHistory = [...history];
      return errorMessage;
    }
  }

  private async getAvailableContentTypes(): Promise<string[]> {
    try {
      // Check cache first for content types
      const cachedContentTypes = await this.getCachedContent('all_content_types', 'content_types');
      if (cachedContentTypes) {
        const cachedData = JSON.parse(cachedContentTypes);
        if (cachedData && Array.isArray(cachedData.content_types)) {
          return cachedData.content_types.map((ct: any) => ct.uid).filter(Boolean);
        }
      }

      const contentTypesResponse = await this.mcpClient.callTool('get_all_content_types', {});
      const contentTypesData = JSON.parse(contentTypesResponse);
      
      // Cache the content types response
      await this.cacheContent('all_content_types', 'content_types', contentTypesResponse);
      
      if (contentTypesData && Array.isArray(contentTypesData.content_types)) {
        return contentTypesData.content_types.map((ct: any) => ct.uid).filter(Boolean);
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error getting content types:', error);
      return [];
    }
  }

  private findBestContentType(query: string, availableTypes: string[]): string {
    if (availableTypes.length === 0) return 'page';
    
    const queryLower = query.toLowerCase();
    
    const typePreferences: {[key: string]: string[]} = {
      product: ['product', 'item', 'goods', 'merchandise', 'collection'],
      blog: ['blog', 'post', 'article', 'news', 'update'],
      page: ['page', 'content', 'information', 'about', 'contact'],
      faq: ['faq', 'question', 'answer', 'help', 'support'],
      asset: ['asset', 'image', 'file', 'picture', 'photo']
    };
    
    let bestMatch = availableTypes[0];
    let bestScore = 0;
    
    availableTypes.forEach(contentType => {
      let score = 0;
      
      if (typePreferences[contentType]) {
        typePreferences[contentType].forEach(keyword => {
          if (queryLower.includes(keyword)) {
            score += 1;
          }
        });
      }
      
      if (queryLower.includes(contentType)) {
        score += 2;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = contentType;
      }
    });
    
    return bestMatch;
  }

  private buildConversationContext(contentstackData: string, queryType?: string, history: ChatMessage[] = []): string {
    const effectiveHistory = history.length > 0 ? history : this.conversationHistory;
    
    const historyContext = effectiveHistory
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
4. Keep responses concise but informative
5. Maintain the conversation context
6. NEVER use markdown formatting like **bold** or _italic_ text
7. Always respond with plain, clean text only

YOUR RESPONSE:`.trim();
  }

  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  clearConversationHistory(): void {
    this.conversationHistory = [];
    this.responseCache.clear();
    console.log('🗑️ Conversation history and cache cleared');
  }

  async shutdown(): Promise<void> {
    // Save content cache before shutdown
    if (this.cacheEnabled) {
      await this.saveContentCache();
    }
    
    await this.mcpClient.disconnect();
    console.log('🔌 Chat Agent shutdown');
  }

  async callTool(toolName: string, params: Record<string, any>): Promise<string> {
    return this.mcpClient.callTool(toolName, params);
  }

  async getContentTypes(): Promise<string> {
    return this.mcpClient.callTool('get_all_content_types', {});
  }

  async getAssets(): Promise<string> {
    return this.mcpClient.callTool('get_all_assets', {});
  }

  async getEntries(contentTypeUid: string): Promise<string> {
    return this.mcpClient.callTool('get_all_entries', { content_type_uid: contentTypeUid });
  }

  async prewarmCommonQueries(queries: string[]): Promise<void> {
    console.log('🔥 Pre-warming common queries...');
    
    for (const query of queries) {
      try {
        // Pre-warm by getting content for common queries and caching it
        const availableTypes = await this.getAvailableContentTypes();
        if (availableTypes.length > 0) {
          const detectedType = this.findBestContentType(query, availableTypes);
          const content = await this.mcpClient.searchContent(query, detectedType);
          await this.cacheContent(query, detectedType, content);
          console.log(`✅ Pre-warmed: "${query}" -> ${detectedType}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to pre-warm: "${query}"`, error);
      }
    }
  }

  getCacheStats(): { size: number; hitRate: number; contentCacheSize: number } {
    return {
      size: this.responseCache.size,
      hitRate: 0.3,
      contentCacheSize: this.contentCache.size
    };
  }

  // New method to manually refresh content cache
  async refreshContentCache(): Promise<void> {
    console.log('🔄 Refreshing content cache...');
    this.contentCache.clear();
    await this.saveContentCache();
    console.log('✅ Content cache refreshed');
  }

  // New method to get cache information
  getContentCacheInfo(): { enabled: boolean; size: number; filePath: string } {
    return {
      enabled: this.cacheEnabled,
      size: this.contentCache.size,
      filePath: this.cacheFilePath
    };
  }
}