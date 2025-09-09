// src/chat-agent.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ContentstackMCPClient } from './mcp-client.js';
import { SearchService } from './search-service.js';
import * as dotenv from 'dotenv';

dotenv.config();

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ContentstackChatAgent {
  private model: ChatGoogleGenerativeAI;
  private mcpClient: ContentstackMCPClient;
  private searchService: SearchService;
  private conversationHistory: ChatMessage[] = [];
  private generalPatterns: RegExp[];

  constructor() {
    this.model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY!,
      model: 'gemini-1.5-flash', // Faster model
      temperature: 0.3, // More deterministic
    });

    this.mcpClient = new ContentstackMCPClient();
    this.searchService = new SearchService();
    
    // Pre-compiled regex patterns for fast general message detection
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
  }

  async initialize(): Promise<void> {
    console.log('🤖 Initializing Chat Agent...');
    await this.mcpClient.connect();
    await this.searchService.initialize(); // Initialize search service
    console.log('✅ Chat Agent ready!');
  }

  private fastContentTypeDetection(userQuery: string): string {
    const query = userQuery.toLowerCase();
    
    if (query.includes('asset') || query.includes('image') || query.includes('file')) return 'asset';
    if (query.includes('content type') || query.includes('content-type')) return 'content_type';
    if (query.includes('entry') || query.includes('page') || query.includes('blog')) return 'page';
    
    // Simple keyword matching instead of LLM call
    if (query.includes('product')) return 'product';
    if (query.includes('blog')) return 'blog_post';
    if (query.includes('article')) return 'article';
    if (query.includes('faq') || query.includes('question')) return 'faq';
    
    return 'page'; // default
  }

  private isGeneralMessage(message: string): boolean {
    const cleaned = message.toLowerCase().trim();
    return this.generalPatterns.some(pattern => pattern.test(cleaned));
  }

  private buildGeneralContext(): string {
    const lastFewMessages = this.conversationHistory.slice(-4);
    
    const historyContext = lastFewMessages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    return `
You are a friendly and helpful AI assistant for Contentstack. Keep responses brief and conversational.

CONVERSATION HISTORY:
${historyContext}

INSTRUCTIONS:
1. Respond naturally to general conversation
2. Keep responses under 2 sentences
3. Be friendly and engaging
4. If asked about your capabilities, mention you can help with content from Contentstack
5. NEVER use markdown formatting like **bold** or _italic_ text
6. Always respond with plain, clean text only

YOUR RESPONSE:`.trim();
  }

  private cleanResponse(response: any): string {
    // Extract content from different response types
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

    // Remove markdown formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

// Add this method to your class
private getInstantGeneralResponse(message: string): string | null {
  const cleaned = message.toLowerCase().trim();
  
  const instantResponses: {pattern: RegExp, response: string}[] = [
    {pattern: /^(hi|hello|hey|greetings)/i, response: "Hello! 👋 How can I help you with Contentstack today?"},
    {pattern: /^(good morning)/i, response: "Good morning! ☀️ How can I assist you with Contentstack?"},
    {pattern: /^(good afternoon)/i, response: "Good afternoon! 🌤️ What can I help you with regarding Contentstack?"},
    {pattern: /^(good evening)/i, response: "Good evening! 🌙 How can I assist you with Contentstack?"},
    {pattern: /^(how are you|how's it going|what's up)/i, response: "I'm doing great, thanks for asking! 😊 How can I help you with Contentstack today?"},
    {pattern: /^(thanks|thank you|appreciate it|cheers)/i, response: "You're welcome! 😊 Is there anything else I can help you with?"},
    {pattern: /^(who are you|what can you do|what are you)/i, response: "I'm a Contentstack assistant! I can help you find content, assets, and answer questions about your Contentstack data. What would you like to know?"},
    {pattern: /^(your name)/i, response: "I'm your Contentstack Assistant! 🤖 How can I help you today?"},
    {pattern: /^(bye|goodbye|see you|exit|quit)/i, response: "Goodbye! 👋 Feel free to come back if you have more questions about Contentstack!"},
    {pattern: /^(help|support)/i, response: "I can help you find content, assets, and answer questions about your Contentstack data. What would you like to know?"},
    {pattern: /^(what is this|what is contentstack)/i, response: "Contentstack is a headless CMS that helps you manage and deliver content across multiple channels. How can I assist you with it?"}
  ];

  for (const {pattern, response} of instantResponses) {
    if (pattern.test(cleaned)) {
      return response;
    }
  }
  
  return null; // No instant match found
}



  // Then update your sendMessage method:
async sendMessage(userMessage: string): Promise<string> {
  try {
    // Add user message to history
    this.conversationHistory.push({ role: 'user', content: userMessage });
    
    console.log(`👤 User: ${userMessage}`);

    // 1. ULTRA-FAST PATH: Instant predefined responses
    const instantResponse = this.getInstantGeneralResponse(userMessage);
    if (instantResponse) {
      console.log('⚡ Ultra-fast general response');
      this.conversationHistory.push({ role: 'assistant', content: instantResponse });
      return instantResponse; // INSTANT return - no API calls!
    }

    // 2. FAST PATH: General chat using LLM (existing logic)
    if (this.isGeneralMessage(userMessage)) {
      console.log('💬 General chat - using fast path');
      const generalContext = this.buildGeneralContext();
      const response = await this.model.invoke(generalContext);
      const assistantResponse = this.cleanResponse(response);
      
      this.conversationHistory.push({ role: 'assistant', content: assistantResponse });
      return assistantResponse;
    }

      // 2. SECOND: Try fast search index
      console.log('🔍 Checking fast search index...');
      const fastMatch = this.searchService.findBestMatch(userMessage);
      if (fastMatch) {
        console.log(`⚡ Fast match found: ${fastMatch.entryId}`);
        this.conversationHistory.push({ role: 'assistant', content: fastMatch.answer });
        return fastMatch.answer; // Instant response!
      }

      // 3. THIRD: Fallback to MCP search
      console.log('🔍 No fast match, using MCP search...');
      let relevantContent: string;
      let queryType: string | undefined;

      const cleaned = userMessage.toLowerCase().trim();
      
      if (cleaned.includes('asset') || cleaned.includes('image') || cleaned.includes('file')) {
        console.log('🔍 Searching for assets...');
        
        try {
          const environments = await this.mcpClient.callTool('get_all_environments', {});
          const envData = JSON.parse(environments);
          
          const availableEnv = envData.environments && envData.environments.length > 0 
            ? envData.environments[0].name 
            : 'production';
          
          const assetParams = {
            environment: availableEnv,
            limit: 10, // Reduced limit for speed
            skip: 0
          };
          
          relevantContent = await this.mcpClient.callTool('get_all_assets', assetParams);
          queryType = 'assets';
          
        } catch (error) {
          const environment = process.env.CONTENTSTACK_ENVIRONMENT || 'production';
          const assetParams = { environment: environment, limit: 10, skip: 0 };
          relevantContent = await this.mcpClient.callTool('get_all_assets', assetParams);
          queryType = 'assets';
        }
      } else if (cleaned.includes('content type') || cleaned.includes('content-type')) {
        console.log('🔍 Getting content types...');
        relevantContent = await this.mcpClient.callTool('get_all_content_types', {});
        queryType = 'content_types';
      } else if (cleaned.includes('entr')) {
        console.log('🔍 Searching for entries...');
        const contentTypeMatch = userMessage.match(/(page|blog|article|product)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].toLowerCase() : 'page';
        relevantContent = await this.mcpClient.callTool('get_all_entries', { 
          content_type_uid: contentType,
          environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production',
          limit: 10 // Reduced limit for speed
        });
        queryType = 'entries';
      } else {
        console.log('🔍 Determining content type...');
        const detectedContentType = this.fastContentTypeDetection(userMessage);
        console.log(`🔍 Smart searching in "${detectedContentType}" content type...`);
        relevantContent = await this.mcpClient.searchContent(userMessage, detectedContentType);
      }
      
      // 4. Build conversation context
      const context = this.buildConversationContext(relevantContent, queryType);
      
      // 5. Generate response using Gemini
      console.log('🤖 Generating response...');
      const response = await this.model.invoke(context);
      
      // 6. Clean and add assistant response to history
      const assistantResponse = this.cleanResponse(response);
      
      this.conversationHistory.push({ role: 'assistant', content: assistantResponse });
      
      // 7. Keep conversation history manageable
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      return assistantResponse;

    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
      this.conversationHistory.push({ role: 'assistant', content: errorMessage });
      return errorMessage;
    }
  }

  private buildConversationContext(contentstackData: string, queryType?: string): string {
    const historyContext = this.conversationHistory
      .slice(0, -1)
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    let instructions = `
You are a helpful Contentstack assistant. Answer the user's question based on the content from our website.

CONVERSATION HISTORY:
${historyContext}

CONTENTSTACK CONTENT:
${contentstackData}

CURRENT USER QUESTION: ${this.conversationHistory[this.conversationHistory.length - 1]?.content}

INSTRUCTIONS:
1. Answer based ONLY on the Contentstack content provided
2. Be conversational and helpful
3. If you don't know the answer, say so
4. Keep responses concise but informative
5. Maintain the conversation context
6. NEVER use markdown formatting like **bold** or _italic_ text
7. Always respond with plain, clean text only
`;

    if (queryType === 'assets') {
      instructions += `
8. You're showing assets - summarize what's available in a user-friendly way
9. Don't show raw JSON - describe the assets conversationally
10. Mention the types of assets available and their purposes
`;
    } else if (queryType === 'content_types') {
      instructions += `
8. You're showing content types - explain what content types are available
9. Don't show raw JSON - describe the content types conversationally
10. Mention what kind of content each type is used for
`;
    } else if (queryType === 'entries') {
      instructions += `
8. You're showing entries - summarize the content in a user-friendly way
9. Don't show raw JSON - describe the entries conversationally
10. Focus on the most relevant information for the user's query
`;
    }

    return `${instructions}\n\nYOUR RESPONSE:`.trim();
  }

  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  clearConversationHistory(): void {
    this.conversationHistory = [];
    console.log('🗑️ Conversation history cleared');
  }

  async shutdown(): Promise<void> {
    await this.mcpClient.disconnect();
    console.log('🔌 Chat Agent shutdown');
  }

  // Wrapper methods
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
}