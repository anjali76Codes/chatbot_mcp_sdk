import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ContentstackMCPClient } from './mcp-client.js';
import * as dotenv from 'dotenv';
import { DynamicContentRouter } from './dynamic-content-router.js';
import { ChatAgentConfig } from './types/contentstack.js';
import { AnalyticsTracker } from './analytics-tracker.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface CacheItem {
  data: any;
  timestamp: number;
  expires: number;
}

interface PersistentSession {
  sessionId: string;
  conversationHistory: ChatMessage[];
  conversationBuffer: ChatMessage[];
  createdAt: number;
  lastAccessed: number;
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

class PersistentSessionManager {
  private sessions = new Map<string, PersistentSession>();
  private sessionsDir: string;
  private sessionTTL: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor(sessionsDir: string = './sessions') {
    this.sessionsDir = sessionsDir;
    this.ensureSessionsDir();
    this.loadSessions();
  }

  private ensureSessionsDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  private loadSessions(): void {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          const filePath = path.join(this.sessionsDir, file);
          
          try {
            const data = fs.readFileSync(filePath, 'utf8');
            const session: PersistentSession = JSON.parse(data);
            
            // Check if session is expired
            if (Date.now() - session.lastAccessed > this.sessionTTL) {
              fs.unlinkSync(filePath);
              continue;
            }
            
            this.sessions.set(sessionId, session);
          } catch (error) {
            console.error(`Error loading session ${sessionId}:`, error);
          }
        }
      }
      
      console.log(`✅ Loaded ${this.sessions.size} persistent sessions`);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }

  getSession(sessionId: string): PersistentSession | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessed = Date.now();
      this.saveSession(session);
    }
    return session || null;
  }

  createSession(sessionId: string): PersistentSession {
    const session: PersistentSession = {
      sessionId,
      conversationHistory: [],
      conversationBuffer: [],
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    this.saveSession(session);
    return session;
  }

  updateSession(sessionId: string, updates: Partial<PersistentSession>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      session.lastAccessed = Date.now();
      this.saveSession(session);
    }
  }

  private saveSession(session: PersistentSession): void {
    try {
      const filePath = this.getSessionFilePath(session.sessionId);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error(`Error saving session ${session.sessionId}:`, error);
    }
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.sessionTTL) {
        try {
          const filePath = this.getSessionFilePath(sessionId);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          this.sessions.delete(sessionId);
        } catch (error) {
          console.error(`Error cleaning up session ${sessionId}:`, error);
        }
      }
    }
  }
}

export class ContentstackChatAgent {
  private model: BaseChatModel;
  private mcpClient: ContentstackMCPClient | null = null;
  private config: ChatAgentConfig;
  private isMCPInitialized: boolean = false;
  private cache: ResponseCache;
  private availableContentTypes: string[] = [];
  private lastContentTypeUpdate: number = 0;
  private contentRouter: DynamicContentRouter | null = null;
  private analyticsTracker: AnalyticsTracker;
  private sessionManager: PersistentSessionManager;
  
  // Current session properties
  private sessionId: string;
  private conversationHistory: ChatMessage[] = [];
  private conversationBuffer: ChatMessage[] = [];
  private maxBufferSize: number = 6;

  constructor(config: ChatAgentConfig = {}) {
    this.config = config;
    this.cache = new ResponseCache();
    this.analyticsTracker = new AnalyticsTracker();
    this.sessionManager = new PersistentSessionManager(config.persistence?.sessionsDir);
    
    // Initialize session
    this.sessionId = config.persistence?.sessionId || uuidv4();
    this.initializeSession();
    
    // Initialize the model based on provider
    this.model = this.initializeModel(config);

    if (config.contentstack?.apiKey && config.contentstack?.managementToken) {
      this.mcpClient = new ContentstackMCPClient({
        apiKey: config.contentstack.apiKey,
        managementToken: config.contentstack.managementToken,
        environment: config.contentstack.environment,
        region: config.contentstack.region
      });
    }

    // Set up periodic cleanup
    setInterval(() => {
      this.analyticsTracker.saveSnapshot();
      this.analyticsTracker.cleanupSessions();
      this.sessionManager.cleanupExpiredSessions();
    }, 60000);
  }

  private initializeSession(): void {
    const existingSession = this.sessionManager.getSession(this.sessionId);
    
    if (existingSession) {
      this.conversationHistory = existingSession.conversationHistory;
      this.conversationBuffer = existingSession.conversationBuffer;
      console.log(`✅ Loaded existing session: ${this.sessionId} (${this.conversationHistory.length} messages)`);
    } else {
      this.sessionManager.createSession(this.sessionId);
      console.log(`✅ Created new session: ${this.sessionId}`);
    }
  }

  private saveSessionState(): void {
    this.sessionManager.updateSession(this.sessionId, {
      conversationHistory: this.conversationHistory,
      conversationBuffer: this.conversationBuffer
    });
  }

  private initializeModel(config: ChatAgentConfig): BaseChatModel {
    const provider = config.llm?.provider || 'google';
    const apiKey = config.llm?.apiKey || this.getDefaultApiKey(provider);
    const modelName = config.llm?.model || this.getDefaultModel(provider);
    const temperature = config.llm?.temperature || 0.3;

    console.log(`🤖 Initializing ${provider.toUpperCase()} model: ${modelName}`);

    switch (provider) {
      case 'openai':
        if (!apiKey) throw new Error('OpenAI API key is required');
        return new ChatOpenAI({ 
          apiKey, 
          modelName,
          temperature,
          configuration: {
            baseURL: config.llm?.baseURL
          }
        });
      
      case 'anthropic':
        if (!apiKey) throw new Error('Anthropic API key is required');
        return new ChatAnthropic({ 
          apiKey, 
          model: modelName,
          temperature 
        });
      
      case 'groq':
        if (!apiKey) throw new Error('Groq API key is required');
        return new ChatGroq({ 
          apiKey, 
          model: modelName,
          temperature 
        });
      
      case 'google':
      default:
        if (!apiKey) throw new Error('Google API key is required');
        return new ChatGoogleGenerativeAI({ 
          apiKey, 
          model: modelName,
          temperature 
        });
    }
  }

  private getDefaultApiKey(provider: string): string {
    const envKeys = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      groq: process.env.GROQ_API_KEY,
      google: process.env.GOOGLE_API_KEY
    };
    return envKeys[provider as keyof typeof envKeys] || '';
  }

  private getDefaultModel(provider: string): string {
    const defaultModels = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku-20240307',
      groq: 'llama-3.1-8b-instant',
      google: 'gemini-2.5-flash'
    };
    return defaultModels[provider as keyof typeof defaultModels] || 'gemini-2.5-flash';
  }

  async initialize(): Promise<void> {
    console.log('🤖 Initializing Chat Agent...');
    
    if (this.mcpClient) {
      try {
        console.log('🔗 Connecting to MCP during initialization...');
        await this.mcpClient.connect();
        this.isMCPInitialized = true;
        console.log('✅ MCP connected successfully');
        
        await this.getAvailableContentTypes(true);
        
        // Initialize the dynamic content router with basic content types
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

  private async needsContentAccess(userMessage: string): Promise<boolean> {
    const lowerMessage = userMessage.toLowerCase().trim();
    
    const generalPatterns = [
      /^(hi|hello|hey|greetings|hola|bonjour|namaste|howdy|yo|sup|wassup|what's up|good morning|good afternoon|good evening)/i,
      /^(thanks|thank you|thx|ty|appreciate it|cheers|grateful|much obliged)/i,
      /^(bye|goodbye|see ya|see you|farewell|cya|adios|take care|have a good one)/i,
      /^(please|pls|plz|sorry|excuse me|pardon|my apologies|forgive me)/i,
      /^(how are you|how're you|how do you do|what's new|how's it going|how have you been)/i,
      /^(who are you|what are you|what can you do|your name|are you ai|are you a bot|are you human)/i,
      /^(yes|no|maybe|sure|ok|okay|alright|fine|cool|great|awesome|perfect|excellent)/i,
      /^(good job|well done|nice work|awesome job|you're smart|you're helpful)/i
    ];

    const isGeneralConversation = generalPatterns.some(pattern => pattern.test(lowerMessage));
    if (isGeneralConversation) {
      console.log('💬 Detected general conversation - no content access needed');
      return false;
    }

    if (this.contentRouter) {
      try {
        const needsContent = await this.contentRouter.determineIfContentNeeded(userMessage);
        console.log(`🔍 Content router determined content needed: ${needsContent}`);
        return needsContent;
      } catch (error) {
        console.error('❌ Error in content router:', error);
        return true;
      }
    }

    console.log('🔍 No content router - assuming content needed');
    return true;
  }

  private buildGeneralContext(history: ChatMessage[]): string {
    const conversationContext = this.getConversationContext();
    
    return `
You are a friendly and helpful AI assistant. Keep responses brief and conversational.

${conversationContext}

INSTRUCTIONS:
1. Respond naturally to general conversation
2. Keep responses under 2 sentences
3. Be friendly and engaging
4. If asked about your capabilities, mention you can help find information
5. NEVER use markdown formatting (no **bold**, *italic*, bullet points with *)
6. Always respond with plain, clean text only
7. Response must be under 50 words
8. Don't mention that you can't help with content if it's a general conversation
9. Use Indian currency format (₹ instead of $) if mentioning prices
10. Maintain context from previous messages when appropriate

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

    let cleanedContent = content
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/_(.*?)_/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/#{1,6}\s?/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    cleanedContent = cleanedContent
        .replace(/\$(\d+(?:\.\d{2})?)/g, '₹$1')
        .replace(/\$(\d+)/g, '₹$1')
        .replace(/USD\s*(\d+(?:\.\d{2})?)/gi, '₹$1')
        .replace(/dollars/gi, 'rupees')
        .replace(/\$/, '₹');

    cleanedContent = cleanedContent
        .replace(/\*\s+([^:]+):/g, '$1:')
        .replace(/\*\s+/g, '')
        .replace(/-\s+/g, '')
        .replace(/(\d+)\.\s+/g, '$1. ')
        .replace(/(\s*[\*\-]\s*)+/g, '\n');

    cleanedContent = cleanedContent
        .split('*')
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .join('\n');

    cleanedContent = cleanedContent
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',')
        .replace(/\s+:/g, ':')
        .replace(/\s+;/g, ';')
        .replace(/([.!?])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim();

    return cleanedContent;
  }

  // Conversation buffer methods
  private updateConversationBuffer(userMessage: string, assistantResponse: string): void {
    // Add new messages to buffer
    this.conversationBuffer.push({ 
      role: 'user', 
      content: userMessage,
      timestamp: Date.now()
    });
    this.conversationBuffer.push({ 
      role: 'assistant', 
      content: assistantResponse,
      timestamp: Date.now()
    });
    
    // Trim buffer if it exceeds max size
    if (this.conversationBuffer.length > this.maxBufferSize) {
      this.conversationBuffer = this.conversationBuffer.slice(-this.maxBufferSize);
    }
    
    this.saveSessionState();
  }

  private getConversationContext(): string {
    if (this.conversationBuffer.length === 0) return '';
    
    return `CONVERSATION HISTORY:
${this.conversationBuffer.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}`;
  }

  private resolveAmbiguousReference(userMessage: string): string {
    const ambiguousPatterns = [
      /(this|that|it)( product| item| one)?/i,
      /the (product|item|one)( you mentioned| we discussed)?/i,
      /(tell me|what about|more about) (it|that|this)/i,
      /(how about|what is|details on) (that|this|it)/i,
      /(remind me|can you remind me|tell me again|what was that) (about|of)/i
    ];
    
    const isAmbiguous = ambiguousPatterns.some(pattern => pattern.test(userMessage));
    
    if (!isAmbiguous || this.conversationBuffer.length === 0) {
      return userMessage;
    }
    
    // Look for the most recent specific content mentioned in the conversation
    const lastAssistantMessage = this.conversationBuffer
      .filter(msg => msg.role === 'assistant')
      .pop();
    
    if (lastAssistantMessage) {
      // Extract specific topics from the last assistant response
      const topicPatterns = [
        /(shipping policy|return policy|warranty policy|delivery policy)/i,
        /([A-Za-z][A-Za-z\s]+earrings|[A-Za-z][A-Za-z\s]+necklace|[A-Za-z][A-Za-z\s]+ring|[A-Za-z][A-Za-z\s]+bracelet|[A-Za-z][A-Za-z\s]+choker)/i,
        /(policy|product|item|collection|delivery|shipping|return|warranty)/i
      ];
      
      for (const pattern of topicPatterns) {
        const match = lastAssistantMessage.content.match(pattern);
        if (match) {
          const topic = match[1] || match[0];
          console.log(`🔍 Resolved ambiguous reference to: ${topic}`);
          return userMessage.replace(/(this|that|it)/i, topic).replace(/(the )?(policy|product|item)/i, topic);
        }
      }
    }
    
    return userMessage;
  }

  async sendMessage(userMessage: string, history: ChatMessage[] = []): Promise<string> {
    const startTime = Date.now();
    let wasSuccessful = false;
    let usedFallback = false;
    let contentTypeUsed: string | undefined;
    
    try {
      // Use persistent history if no explicit history provided
      if (history.length === 0) {
        history = [...this.conversationHistory];
      }
      
      // Resolve ambiguous references first
      const resolvedMessage = this.resolveAmbiguousReference(userMessage);
      
      history.push({ 
        role: 'user', 
        content: resolvedMessage,
        timestamp: Date.now()
      });
      this.conversationHistory = [...history];

      console.log(`👤 User: ${resolvedMessage}`);

      const needsContent = await this.needsContentAccess(resolvedMessage);
      
      if (!needsContent) {
        console.log('💬 General conversation - using LLM only');
        const generalContext = this.buildGeneralContext(history);
        const response = await this.model.invoke(generalContext);
        const assistantResponse = this.cleanResponse(response);
        
        history.push({ 
          role: 'assistant', 
          content: assistantResponse,
          timestamp: Date.now()
        });
        this.conversationHistory = [...history];
        
        // Update conversation buffer and save session
        this.updateConversationBuffer(userMessage, assistantResponse);
        
        wasSuccessful = true;
        console.log(`⚡ Response time: ${Date.now() - startTime}ms`);
        return assistantResponse;
      }

      if (!this.mcpClient) {
        const noMCPResponse = "I can help with general questions, but content access is not configured. Please check your Contentstack settings.";
        history.push({ 
          role: 'assistant', 
          content: noMCPResponse,
          timestamp: Date.now()
        });
        this.conversationHistory = [...history];
        this.saveSessionState();
        return noMCPResponse;
      }

      console.log('🔍 Content-related query - checking cache first...');
      
      const cacheKey = `query:${userMessage.toLowerCase().trim()}`;
      const cachedResponse = this.cache.get(cacheKey);
      
      if (cachedResponse) {
        console.log('🎯 Cache hit - returning cached response');
        history.push({ 
          role: 'assistant', 
          content: cachedResponse,
          timestamp: Date.now()
        });
        this.conversationHistory = [...history];
        
        // Update conversation buffer and save session
        this.updateConversationBuffer(userMessage, cachedResponse);
        
        wasSuccessful = true;
        // Try to detect content type from cached response
        if (cachedResponse.includes('product')) contentTypeUsed = 'products';
        else if (cachedResponse.includes('policy')) contentTypeUsed = 'policies';
        else if (cachedResponse.includes('FAQ')) contentTypeUsed = 'faqs';
        
        console.log(`⚡ Response time: ${Date.now() - startTime}ms (CACHED)`);
        return cachedResponse;
      }

      console.log('🔍 Cache miss - ensuring MCP is connected...');

      let assistantResponse: string = '';

      if (this.contentRouter) {
        try {
          console.log('🧠 Using LangChain agent for content routing...');
          assistantResponse = await this.contentRouter.routeQuery(userMessage, history);
          // Try to detect content type from router response
          if (assistantResponse.includes('product')) contentTypeUsed = 'products';
          else if (assistantResponse.includes('policy')) contentTypeUsed = 'policies';
          else if (assistantResponse.includes('FAQ')) contentTypeUsed = 'faqs';
        } catch (error) {
          console.error('❌ Error in content router:', error);
          usedFallback = true;
          assistantResponse = await this.fallbackContentSearch(userMessage, history);
        }
      } else {
        usedFallback = true;
        assistantResponse = await this.fallbackContentSearch(userMessage, history);
      }

      if (assistantResponse && 
          !assistantResponse.includes('Unable to') && 
          !assistantResponse.includes('No content') &&
          !assistantResponse.includes("couldn't find") &&
          !assistantResponse.includes("error")) {
        this.cache.set(cacheKey, assistantResponse, 2 * 60 * 1000);
        wasSuccessful = true;
      }
      
      history.push({ 
        role: 'assistant', 
        content: assistantResponse,
        timestamp: Date.now()
      });
      this.conversationHistory = [...history];

      // Update conversation buffer and save session
      this.updateConversationBuffer(userMessage, assistantResponse);

      // Keep only last 20 messages in history to prevent memory issues
      if (history.length > 20) {
        history.splice(0, history.length - 20);
        this.conversationHistory = [...history];
        this.saveSessionState();
      }

      console.log(`⚡ Response time: ${Date.now() - startTime}ms`);
      return assistantResponse;
    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
      history.push({ 
        role: 'assistant', 
        content: errorMessage,
        timestamp: Date.now()
      });
      this.conversationHistory = [...history];
      this.saveSessionState();
      return errorMessage;
    } finally {
      // Always track the query, even if it failed
      const responseTime = Date.now() - startTime;
      this.analyticsTracker.trackQuery(
        userMessage,
        responseTime,
        wasSuccessful,
        usedFallback,
        contentTypeUsed,
        this.sessionId
      );
    }
  }

  async *sendMessageStream(userMessage: string, history: ChatMessage[] = []): AsyncGenerator<string> {
    const startTime = Date.now();
    let wasSuccessful = false;
    let usedFallback = false;
    let contentTypeUsed: string | undefined;
    let fullResponse = '';

    try {
      // Use persistent history if no explicit history provided
      if (history.length === 0) {
        history = [...this.conversationHistory];
      }
      
      // Resolve ambiguous references first
      const resolvedMessage = this.resolveAmbiguousReference(userMessage);
      
      history.push({ 
        role: 'user', 
        content: resolvedMessage,
        timestamp: Date.now()
      });
      this.conversationHistory = [...history];

      console.log(`👤 User (stream): ${resolvedMessage}`);

      const needsContent = await this.needsContentAccess(resolvedMessage);
      
      if (!needsContent) {
        console.log('💬 General conversation - using LLM only (stream)');
        const generalContext = this.buildGeneralContext(history);
        
        const stream = await this.model.stream(generalContext);
        
        for await (const chunk of stream) {
          const chunkText = this.cleanResponse(chunk);
          if (chunkText) {
            fullResponse += chunkText;
            yield chunkText;
          }
        }
        
        history.push({ 
          role: 'assistant', 
          content: fullResponse,
          timestamp: Date.now()
        });
        this.conversationHistory = [...history];
        
        // Update conversation buffer and save session
        this.updateConversationBuffer(userMessage, fullResponse);
        
        wasSuccessful = true;
        console.log(`⚡ Stream response time: ${Date.now() - startTime}ms`);
        return;
      }

      if (!this.mcpClient) {
        const noMCPResponse = "I can help with general questions, but content access is not configured. Please check your Contentstack settings.";
        yield noMCPResponse;
        history.push({ 
          role: 'assistant', 
          content: noMCPResponse,
          timestamp: Date.now()
        });
        this.conversationHistory = [...history];
        this.saveSessionState();
        return;
      }

      console.log('🔍 Content-related query - streaming response...');

      const finalResponse = await this.sendMessage(userMessage, history);
      fullResponse = finalResponse;
      
      for (let i = 0; i < finalResponse.length; i++) {
        yield finalResponse[i];
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      wasSuccessful = true;
      // Try to detect content type from response
      if (finalResponse.includes('product')) contentTypeUsed = 'products';
      else if (finalResponse.includes('policy')) contentTypeUsed = 'policies';
      else if (finalResponse.includes('FAQ')) contentTypeUsed = 'faqs';

    } catch (error) {
      console.error('❌ Error in sendMessageStream:', error);
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
      yield errorMessage;
    } finally {
      const responseTime = Date.now() - startTime;
      this.analyticsTracker.trackQuery(
        userMessage,
        responseTime,
        wasSuccessful,
        usedFallback,
        contentTypeUsed,
        this.sessionId
      );
    }
  }

  private async fallbackContentSearch(userMessage: string, history: ChatMessage[]): Promise<string> {
    console.log('🔍 Falling back to direct content search...');
    
    try {
        const availableContentTypes = await this.getAvailableContentTypes();
        
        if (availableContentTypes.length === 0) {
            return "I don't have any content available to answer your question.";
        }
        
        // Prioritize content types based on query
        const prioritizedTypes = this.prioritizeContentTypes(userMessage, availableContentTypes);
        
        for (const contentType of prioritizedTypes) {
            try {
                console.log(`🔄 Searching in: ${contentType}`);
                const providerName = this.getProviderName();
                const searchResult = await this.mcpClient!.smartSearchContent(userMessage, contentType, providerName);
                
                if (searchResult && !searchResult.includes('Unable to') && !searchResult.includes('No content')) {
                    const context = this.buildConversationContext(searchResult, undefined, history);
                    const response = await this.model.invoke(context);
                    const assistantResponse = this.cleanResponse(response);
                    
                    if (assistantResponse && !assistantResponse.includes('Unable to')) {
                        console.log(`✅ Found results in ${contentType}`);
                        return assistantResponse;
                    }
                }
            } catch (error: any) {
                // Skip token limit errors in fallback to avoid infinite loops
                if (error?.status === 413) {
                    console.log(`⚠️ Token limit in ${contentType}, skipping...`);
                    continue;
                }
                console.log(`❌ Error searching in ${contentType}:`, error);
                continue;
            }
        }
        
        return "I couldn't find specific information about that. Could you try asking in a different way?";
    } catch (error) {
        console.error('❌ Error in fallback content search:', error);
        return "I encountered an error while searching for information. Please try again.";
    }
  }

  private getProviderName(): string {
    const modelName = this.model.constructor.name.toLowerCase();
    
    if (modelName.includes('groq')) return 'groq';
    if (modelName.includes('google')) return 'google';
    if (modelName.includes('openai') || modelName.includes('gpt')) return 'openai';
    if (modelName.includes('anthropic') || modelName.includes('claude')) return 'anthropic';
    
    return 'google'; // default
  }

  private prioritizeContentTypes(userMessage: string, contentTypes: string[]): string[] {
    const lowerMessage = userMessage.toLowerCase();
    
    // Product-related queries
    if (lowerMessage.includes('product') || 
        lowerMessage.includes('price') || 
        lowerMessage.includes('collection') ||
        lowerMessage.includes('jhumka') ||
        lowerMessage.includes('earring') ||
        lowerMessage.includes('ring') ||
        lowerMessage.includes('necklace') ||
        lowerMessage.includes('bracelet')) {
        return contentTypes.sort((a, b) => {
            if (a === 'product') return -1;
            if (b === 'product') return 1;
            if (a.includes('product')) return -1;
            if (b.includes('product')) return 1;
            return 0;
        });
    }
    
    // FAQ/policy queries
    if (lowerMessage.includes('policy') || 
        lowerMessage.includes('return') || 
        lowerMessage.includes('shipping') ||
        lowerMessage.includes('warranty') ||
        lowerMessage.includes('faq')) {
        return contentTypes.sort((a, b) => {
            if (a === 'faqs') return -1;
            if (b === 'faqs') return 1;
            if (a.includes('policy')) return -1;
            if (b.includes('policy')) return 1;
            return 0;
        });
    }
    
    return contentTypes; // Default order
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
    const conversationContext = this.getConversationContext();
    const effectiveHistory = history.length > 0 ? history : this.conversationHistory;
    
    return `
You are a helpful AI assistant. Answer the user's question based on the content provided.

${conversationContext}

CONTENT DATA:
${contentstackData}

CURRENT USER QUESTION: ${effectiveHistory[effectiveHistory.length - 1]?.content}

INSTRUCTIONS:
1. Answer based ONLY on the content provided
2. Be conversational and helpful
3. If you don't know the answer, say so
4. Keep responses concise but informative (under 100 words)
5. Maintain the conversation context
6. NEVER use markdown formatting (no **bold**, *italic*, bullet points with *)
7. Always respond with plain, clean text only
8. Use Indian currency format (₹ instead of $)
9. For lists, use simple line breaks instead of bullet points
10. Prices should be in Indian Rupees format (₹ symbol)
11. If the user refers to something mentioned earlier (like "this product"), use the conversation context to understand what they mean

YOUR RESPONSE:`.trim();
  }

  // Analytics methods
  getAnalyticsSnapshot() {
    return this.analyticsTracker.getCurrentSnapshot();
  }

  getLiveMetrics() {
    return this.analyticsTracker.getLiveMetrics();
  }

  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  getSessionId(): string {
    return this.sessionId;
  }

  clearConversationHistory(): void {
    this.conversationHistory = [];
    this.conversationBuffer = [];
    this.cache.clear();
    this.saveSessionState();
    console.log('🗑️ Conversation history, buffer, and cache cleared');
  }

  async shutdown(): Promise<void> {
    if (this.mcpClient && this.isMCPInitialized) {
      await this.mcpClient.disconnect();
    }
    this.saveSessionState();
    console.log('🔌 Chat Agent shutdown');
  }
}