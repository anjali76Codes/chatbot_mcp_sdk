// src/chat-agent.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ContentstackMCPClient } from './mcp-client.js';
import * as dotenv from 'dotenv';
import { AutoContentMapper } from './auto-content-mapper.js';
import { DynamicContentRouter } from './dynamic-content-router.js'; // Fixed typo in import

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
  private isMCPInitialized: boolean = false;
  private cache: ResponseCache;
  private availableContentTypes: string[] = [];
  private lastContentTypeUpdate: number = 0;
  private contentMapper: AutoContentMapper | null = null;
  private contentRouter: DynamicContentRouter | null = null;

  constructor(config: ChatAgentConfig = {}) {
    this.config = config;
    this.cache = new ResponseCache();
    
    const llmApiKey = config.llm?.apiKey || process.env.GOOGLE_API_KEY!;
    const llmModel = config.llm?.model || 'gemini-2.5-flash';
    const llmTemperature = config.llm?.temperature || 0.3;

    this.model = new ChatGoogleGenerativeAI({
      apiKey: llmApiKey,
      model: llmModel,
      temperature: llmTemperature,
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
        
        // Initialize the dynamic content router
        this.contentRouter = new DynamicContentRouter(
          this.model,
          this.mcpClient,
          this.availableContentTypes
        );
        
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

  // SIMPLIFIED INTENT DETECTION - Uses LangChain agent for deep understanding
  private async needsContentAccess(userMessage: string): Promise<boolean> {
    const lowerMessage = userMessage.toLowerCase().trim();
    
    // First check for obvious general conversation patterns
    const generalPatterns = [
      // Greetings
      /^(hi|hello|hey|greetings|hola|bonjour|namaste|howdy|yo|sup|wassup|what's up|good morning|good afternoon|good evening)/i,
      // Gratitude
      /^(thanks|thank you|thx|ty|appreciate it|cheers|grateful|much obliged)/i,
      // Farewells
      /^(bye|goodbye|see ya|see you|farewell|cya|adios|take care|have a good one)/i,
      // Politeness
      /^(please|pls|plz|sorry|excuse me|pardon|my apologies|forgive me)/i,
      // Small talk
      /^(how are you|how're you|how do you do|what's new|how's it going|how have you been)/i,
      // Identity questions
      /^(who are you|what are you|what can you do|your name|are you ai|are you a bot|are you human)/i,
      // Simple responses
      /^(yes|no|maybe|sure|ok|okay|alright|fine|cool|great|awesome|perfect|excellent)/i,
      // Compliments
      /^(good job|well done|nice work|awesome job|you're smart|you're helpful)/i
    ];

    // Check for general patterns first
    const isGeneralConversation = generalPatterns.some(pattern => pattern.test(lowerMessage));
    if (isGeneralConversation) {
      console.log('💬 Detected general conversation - no content access needed');
      return false;
    }

    // For everything else, use the LangChain agent to determine if content is needed
    if (this.contentRouter) {
      try {
        const needsContent = await this.contentRouter.determineIfContentNeeded(userMessage);
        console.log(`🔍 Content router determined content needed: ${needsContent}`);
        return needsContent;
      } catch (error) {
        console.error('❌ Error in content router:', error);
        // Fallback: assume content is needed for non-general conversations
        return true;
      }
    }

    // Fallback: if no router, assume content is needed
    console.log('🔍 No content router - assuming content needed');
    return true;
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
4. If asked about your capabilities, mention you can help find information
5. NEVER use markdown formatting
6. Always respond with plain, clean text only
7. Response must be under 50 words
8. Don't mention that you can't help with content if it's a general conversation

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

      // 🚀 IMPROVED INTENT DETECTION with LangChain agent
      const needsContent = await this.needsContentAccess(userMessage);
      
      if (!needsContent) {
        console.log('💬 General conversation - using LLM only');
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
      
      // 🚀 CACHE CHECK
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
      // await this.ensureMCPConnected();

      let assistantResponse: string = '';

      // 🚀 USE LANGCHAIN AGENT FOR CONTENT ROUTING
      if (this.contentRouter) {
        try {
          console.log('🧠 Using LangChain agent for content routing...');
          assistantResponse = await this.contentRouter.routeQuery(userMessage, history);
        } catch (error) {
          console.error('❌ Error in content router:', error);
          // Fallback to direct MCP search
          assistantResponse = await this.fallbackContentSearch(userMessage, history);
        }
      } else {
        // Fallback to direct MCP search
        assistantResponse = await this.fallbackContentSearch(userMessage, history);
      }

      // Cache successful responses
      if (assistantResponse && 
          !assistantResponse.includes('Unable to') && 
          !assistantResponse.includes('No content') &&
          !assistantResponse.includes("couldn't find") &&
          !assistantResponse.includes("error")) {
        this.cache.set(cacheKey, assistantResponse, 2 * 60 * 1000);
      }
      
      history.push({ role: 'assistant', content: assistantResponse });
      this.conversationHistory = [...history];

      // Keep conversation history manageable
      if (history.length > 10) {
        history.splice(0, history.length - 10);
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

  // Fallback content search method
  private async fallbackContentSearch(userMessage: string, history: ChatMessage[]): Promise<string> {
    console.log('🔍 Falling back to direct content search...');
    
    try {
      const availableContentTypes = await this.getAvailableContentTypes();
      
      if (availableContentTypes.length === 0) {
        return "I don't have any content available to answer your question.";
      }
      
      // Try each content type until we find results
      for (const contentType of availableContentTypes) {
        try {
          const searchResult = await this.mcpClient!.searchContent(userMessage, contentType);
          
          if (searchResult && !searchResult.includes('Unable to') && !searchResult.includes('No content')) {
            const context = this.buildConversationContext(searchResult, undefined, history);
            const response = await this.model.invoke(context);
            const assistantResponse = this.cleanResponse(response);
            
            if (assistantResponse && !assistantResponse.includes('Unable to')) {
              console.log(`✅ Found results in ${contentType}`);
              return assistantResponse;
            }
          }
        } catch (error) {
          console.log(`❌ Error searching in ${contentType}:`, error);
          continue; // Try next content type
        }
      }
      
      // If still no response after trying all content types
      return "I couldn't find specific information about that. Could you try asking in a different way?";
    } catch (error) {
      console.error('❌ Error in fallback content search:', error);
      return "I encountered an error while searching for information. Please try again.";
    }
  }

  private async getAvailableContentTypes(forceRefresh: boolean = false): Promise<string[]> {
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
      
      await this.ensureMCPConnected();
      
      const contentTypesResponse = await this.mcpClient.callTool('get_all_content_types', {});
      const contentTypesData = JSON.parse(contentTypesResponse);
      
      if (contentTypesData && Array.isArray(contentTypesData.content_types)) {
        this.availableContentTypes = contentTypesData.content_types
          .map((ct: any) => ct.uid)
          .filter(Boolean);
        
        this.lastContentTypeUpdate = now;
        
        // Update content router with new content types
        if (this.contentRouter) {
          this.contentRouter.updateContentTypes(this.availableContentTypes);
        }
        
        return this.availableContentTypes;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error getting content types:', error);
      return this.availableContentTypes.length > 0 ? this.availableContentTypes : [];
    }
  }

  private buildConversationContext(contentstackData: string, queryType?: string, history: ChatMessage[] = []): string {
    const effectiveHistory = history.length > 0 ? history : this.conversationHistory;
    
    const historyContext = effectiveHistory
      .slice(-3)
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