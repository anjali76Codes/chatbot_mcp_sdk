// src/chat-agent.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ContentstackMCPClient } from './mcp-client.js';
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
    provider: 'google' | 'openai' | 'anthropic';
    apiKey?: string;
    model?: string;
    temperature?: number;
  };
}

export class ContentstackChatAgent {
  private model: ChatGoogleGenerativeAI;
  private mcpClient: ContentstackMCPClient | null = null;
  private conversationHistory: ChatMessage[] = [];
  private config: ChatAgentConfig;
  private isMCPInitialized: boolean = false;

  constructor(config: ChatAgentConfig = {}) {
    this.config = config;
    
    const llmApiKey = config.llm?.apiKey || process.env.GOOGLE_API_KEY!;
    const llmModel = config.llm?.model || 'gemini-2.5-pro';
    const llmTemperature = config.llm?.temperature || 0.3;

    this.model = new ChatGoogleGenerativeAI({
      apiKey: llmApiKey,
      model: llmModel,
      temperature: llmTemperature,
    });

    // Initialize MCP client but don't connect yet
    this.mcpClient = new ContentstackMCPClient({
      apiKey: config.contentstack?.apiKey,
      managementToken: config.contentstack?.deliveryToken,
      environment: config.contentstack?.environment,
      region: config.contentstack?.region
    });
  }

  async initialize(): Promise<void> {
    console.log('🤖 Initializing Chat Agent...');
    // Don't connect to MCP yet - wait until needed
    console.log('✅ Chat Agent ready! (MCP will connect on demand)');
  }

  private async ensureMCPConnected(): Promise<void> {
    if (!this.isMCPInitialized && this.mcpClient) {
      console.log('🔗 Connecting to MCP on demand...');
      await this.mcpClient.connect();
      this.isMCPInitialized = true;
      console.log('✅ MCP connected successfully');
    }
  }

  // 🚀 LIGHTNING-FAST KEYWORD-BASED INTENT DETECTION (ADD THIS METHOD)
  private needsContentAccess(userMessage: string): boolean {
    const contentKeywords = [
      'product', 'item', 'show', 'find', 'search', 'content', 'asset', 
      'entry', 'type', 'catalog', 'collection', 'price', 'buy', 'shop',
      'detail', 'spec', 'feature', 'image', 'photo', 'file', 'document',
      'article', 'blog', 'post', 'news', 'update', 'listing', 'inventory',
      'stock', 'availability', 'cost', 'order', 'purchase', 'description',
      'info', 'information', 'data', 'record', 'file', 'media', 'picture'
    ];
    
    const generalKeywords = [
      'hi', 'hello', 'hey', 'thanks', 'thank', 'please', 'sorry', 'bye',
      'goodbye', 'how are you', 'what\'s up', 'help', 'who are you', 'what can you do',
      'good morning', 'good afternoon', 'good evening', 'greetings', 'welcome',
      'appreciate', 'cheers', 'ok', 'okay', 'alright', 'yes', 'no', 'maybe',
      'perhaps', 'well', 'oh', 'ah', 'uh', 'hmm', 'interesting', 'awesome',
      'great', 'perfect', 'excellent', 'wonderful', 'fantastic', 'nice', 'cool',
      'what is this', 'what is contentstack', 'explain', 'tell me about'
    ];

    const lowerMessage = userMessage.toLowerCase();
    
    // Check if it's definitely general conversation (INSTANT)
    if (generalKeywords.some(keyword => lowerMessage.includes(keyword))) {
      console.log('⚡ General conversation detected via keywords');
      return false;
    }
    
    // Check if it needs content (INSTANT)
    const needsContent = contentKeywords.some(keyword => lowerMessage.includes(keyword));
    if (needsContent) {
      console.log('⚡ Content query detected via keywords');
    }
    return needsContent;
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

  async sendMessage(userMessage: string, history: ChatMessage[] = []): Promise<string> {
    try {
        if (!history) {
            history = [];
        }

        history.push({ role: 'user', content: userMessage });
        this.conversationHistory = [...history];

        console.log(`👤 User: ${userMessage}`);

        // 🚀 LIGHTNING-FAST INTENT DETECTION (REPLACED THE OLD SLOW METHOD)
        const needsContent = this.needsContentAccess(userMessage);
        
        if (!needsContent) {
            console.log('💬 General conversation - using LLM only (no MCP)');
            const generalContext = this.buildGeneralContext(history);
            const response = await this.model.invoke(generalContext);
            const assistantResponse = this.cleanResponse(response);
            history.push({ role: 'assistant', content: assistantResponse });
            this.conversationHistory = [...history];
            return assistantResponse;
        }

        console.log('🔍 Content-related query - connecting to MCP...');
        await this.ensureMCPConnected();

        if (this.isShowAllQuery(userMessage)) {
            console.log('🔍 Show all collection requested');
            const availableContentTypes = await this.getAvailableContentTypes();
            
            if (availableContentTypes.length === 0) {
                const noItemsResponse = "I don't have any items in my collection yet.";
                history.push({ role: 'assistant', content: noItemsResponse });
                this.conversationHistory = [...history];
                return noItemsResponse;
            }
            
            const allContent = await this.mcpClient!.searchContent(userMessage, availableContentTypes[0]);
            const context = this.buildConversationContext(allContent, 'collection', history);
            const response = await this.model.invoke(context);
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
                
                try {
                    const environments = await this.mcpClient!.callTool('get_all_environments', {});
                    const envData = JSON.parse(environments);
                    const availableEnv = envData.environments?.[0]?.name ?? 'production';
                    relevantContent = await this.mcpClient!.callTool('get_all_assets', {
                        environment: availableEnv,
                        limit: 10,
                        skip: 0
                    });
                } catch (error) {
                    console.error('Error getting assets:', error);
                    const environment = process.env.CONTENTSTACK_ENVIRONMENT || 'production';
                    relevantContent = await this.mcpClient!.callTool('get_all_assets', {
                        environment,
                        limit: 10,
                        skip: 0
                    });
                }
            } else if (cleaned.includes('content type') || cleaned.includes('content-type')) {
                console.log('🔍 Getting content types...');
                queryType = 'content_types';
                relevantContent = await this.mcpClient!.callTool('get_all_content_types', {});
            } else {
                console.log('🔍 Determining content type...');
                
                const availableContentTypes = await this.getAvailableContentTypes();
                
                if (availableContentTypes.length === 0) {
                    console.log('⚠️ No content types available');
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
                    relevantContent = await this.mcpClient!.searchContent(userMessage, availableTypes[0]);
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
      if (!this.mcpClient) {
        throw new Error('MCP client not initialized');
      }
      
      const contentTypesResponse = await this.mcpClient.callTool('get_all_content_types', {});
      const contentTypesData = JSON.parse(contentTypesResponse);
      
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
    console.log('🗑️ Conversation history cleared');
  }

  async shutdown(): Promise<void> {
    if (this.mcpClient && this.isMCPInitialized) {
      await this.mcpClient.disconnect();
    }
    console.log('🔌 Chat Agent shutdown');
  }

  async callTool(toolName: string, params: Record<string, any>): Promise<string> {
    await this.ensureMCPConnected();
    return this.mcpClient!.callTool(toolName, params);
  }

  async getContentTypes(): Promise<string> {
    await this.ensureMCPConnected();
    return this.mcpClient!.callTool('get_all_content_types', {});
  }

  async getAssets(): Promise<string> {
    await this.ensureMCPConnected();
    return this.mcpClient!.callTool('get_all_assets', {});
  }

  async getEntries(contentTypeUid: string): Promise<string> {
    await this.ensureMCPConnected();
    return this.mcpClient!.callTool('get_all_entries', { content_type_uid: contentTypeUid });
  }
}