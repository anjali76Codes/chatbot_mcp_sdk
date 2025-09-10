// src/chat-agent.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ContentstackMCPClient } from './mcp-client.js';
import { SearchService } from './search-service.js';
import { ContentIndexGenerator } from './generate-content-index.js'; // FIXED: Use the correct name
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
}

export class ContentstackChatAgent {
  private model: ChatGoogleGenerativeAI;
  private mcpClient: ContentstackMCPClient;
  private searchService: SearchService;
  private conversationHistory: ChatMessage[] = [];
  private generalPatterns: RegExp[];
  private reindexInterval: NodeJS.Timeout | null = null;
  private lastIndexUpdate: Date | null = null;
  private config: ChatAgentConfig;

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

    this.searchService = new SearchService();
    
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
    
    // FIXED: Renamed to generateContentIndex
    console.log('📝 Generating content index...');
    await this.generateContentIndex();
    
    await this.searchService.initialize();
    
    this.startPeriodicReindexing(30 * 60 * 1000);
    
    console.log('✅ Chat Agent ready!');
  }


private isShowAllQuery(message: string): boolean {
  const showAllPatterns = [
    /show\s+(me\s+)?(all|every|complete|full)/i,
    /display\s+(all|every|complete|full)/i,
    /list\s+(all|every|complete|full)/i,
    /what\s+(do\s+you\s+have|products?|items?|collection)/i,
    /(all|every|complete|full)\s+(products?|items?|collection)/i,
    /show\s+your\s+collection/i,
    /show\s+me\s+your\s+products/i,
    /what's\s+in\s+(your|the)\s+collection/i,
    /show\s+me\s+everything/i,
    /all\s+products/i,
    /complete\s+catalog/i,
    /full\s+collection/i
  ];
  
  return showAllPatterns.some(pattern => pattern.test(message.toLowerCase()));
}

private formatAllItemsResponse(items: any[]): string {
  if (items.length === 0) {
    return "I don't have any products in my collection yet.";
  }
  
  let response = `Here's my complete collection (${items.length} items):\n\n`;
  
  items.forEach((item, index) => {
    response += `${index + 1}. **${item.title}**`;
    if (item.description) {
      response += ` - ${item.description}`;
    }
    response += '\n';
  });
  
  response += '\nWould you like to know more about any specific item?';
  return response;
}


  // FIXED: Renamed this method
  private async generateContentIndex(): Promise<void> {
    try {
      const indexGenerator = new ContentIndexGenerator(); // FIXED: Use correct class name
      await indexGenerator.generateIndex();
      this.lastIndexUpdate = new Date();
      console.log('✅ Content index generated successfully');
    } catch (error) {
      console.warn('⚠️ Could not generate content index, using existing one if available:', error);
    }
  }

  private startPeriodicReindexing(intervalMs: number): void {
    this.reindexInterval = setInterval(async () => {
      console.log('🔄 Periodic content index update...');
      await this.generateContentIndex();
      await this.searchService.initialize();
    }, intervalMs);
  }

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
    
    return null;
  }

  private fastContentTypeDetection(userQuery: string): string {
    const query = userQuery.toLowerCase();
    
    if (query.includes('asset') || query.includes('image') || query.includes('file')) return 'asset';
    if (query.includes('content type') || query.includes('content-type')) return 'content_type';
    
    // ==== CUSTOMIZE THIS FOR YOUR JEWELRY WEBSITE ====
    if (query.includes('product') || query.includes('jewelry') || query.includes('necklace') || query.includes('earring') || query.includes('ring') || query.includes('bracelet') || query.includes('watch')) return 'product';
    // ================================================

    if (query.includes('entry') || query.includes('page') || query.includes('blog')) return 'page';
    if (query.includes('blog')) return 'blog_post';
    if (query.includes('article')) return 'article';
    if (query.includes('faq') || query.includes('question')) return 'faq';
    
    return 'product'; 
  }
  private isGeneralMessage(message: string): boolean {
    const cleaned = message.toLowerCase().trim();
    return this.generalPatterns.some(pattern => pattern.test(cleaned));
  }

  // ✅ Fixed: now accepts history
  private buildGeneralContext(history: ChatMessage[]): string {
    const lastFewMessages = history.slice(-4);
    
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
    // Ensure we have a valid history array
    if (!history) {
      history = [];
    }

    // Add user message to history
    history.push({ role: 'user', content: userMessage });
    this.conversationHistory = [...history]; // Keep internal sync

    console.log(`👤 User: ${userMessage}`);

    const instantResponse = this.getInstantGeneralResponse(userMessage);
    if (instantResponse) {
      console.log('⚡ Ultra-fast general response');
      history.push({ role: 'assistant', content: instantResponse });
      this.conversationHistory = [...history];
      return instantResponse;
    }

    // Check if this is a "show all" query
    if (this.isShowAllQuery(userMessage)) {
      console.log('🔍 Show all collection requested');
      const allItems = this.searchService.getAllItems();
      if (allItems.length > 0) {
        const response = this.formatAllItemsResponse(allItems);
        history.push({ role: 'assistant', content: response });
        this.conversationHistory = [...history];
        return response;
      } else {
        const noItemsResponse = "I don't have any products in my collection yet.";
        history.push({ role: 'assistant', content: noItemsResponse });
        this.conversationHistory = [...history];
        return noItemsResponse;
      }
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

    console.log('🔍 Checking fast search index...');
    const fastMatch = this.searchService.findBestMatch(userMessage);
    if (fastMatch) {
      console.log(`⚡ Fast match found: ${fastMatch.uid}`);
      
      // Get the full content for the matched entry
      try {
        console.log(`📖 Fetching full content for entry ${fastMatch.uid}...`);
        const fullContent = await this.mcpClient.callTool('get_single_entry', {
          entry_id: fastMatch.uid, // ← CORRECT (based on the error message)
          content_type_uid: fastMatch.contentType,
          environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production'
        });
        
        // Build a response based on the full content
        const context = this.buildConversationContext(fullContent, 'entry', history);
        const response = await this.model.invoke(context);
        const assistantResponse = this.cleanResponse(response);
        
        history.push({ role: 'assistant', content: assistantResponse });
        this.conversationHistory = [...history];
        return assistantResponse;
        
      } catch (error) {
        console.error('Error fetching full content for fast match:', error);
        // Fall back to using just the title/description
        const fallbackResponse = `I found information about "${fastMatch.title}". ${fastMatch.description || 'Would you like to know more about this?'}`;
        history.push({ role: 'assistant', content: fallbackResponse });
        this.conversationHistory = [...history];
        return fallbackResponse;
      }
    }

    console.log('🔍 No fast match, using MCP search...');
    let relevantContent: string = ''; // Initialize with empty string
    let queryType: string | undefined;
    const cleaned = userMessage.toLowerCase().trim();

    if (cleaned.includes('asset') || cleaned.includes('image') || cleaned.includes('file')) {
        console.log('🔍 Searching for assets...');
        try {
            const environments = await this.mcpClient.callTool('get_all_environments', {});
            const envData = JSON.parse(environments);
            const availableEnv = envData.environments?.[0]?.name ?? 'production';
            relevantContent = await this.mcpClient.callTool('get_all_assets', {
                environment: availableEnv,
                limit: 10,
                skip: 0
            });
            queryType = 'assets';
        } catch (error) {
            console.error('Error getting assets:', error);
            const environment = process.env.CONTENTSTACK_ENVIRONMENT || 'production';
            relevantContent = await this.mcpClient.callTool('get_all_assets', {
                environment,
                limit: 10,
                skip: 0
            });
            queryType = 'assets';
        }
    } else if (cleaned.includes('content type') || cleaned.includes('content-type')) {
        console.log('🔍 Getting content types...');
        relevantContent = await this.mcpClient.callTool('get_all_content_types', {});
        queryType = 'content_types';
    } else if (cleaned.includes('entr')) {
        console.log('🔍 Searching for entries...');
        const contentTypeMatch = userMessage.match(/(page|blog|article|product)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].toLowerCase() : 'product';
        relevantContent = await this.mcpClient.callTool('get_all_entries', {
            content_type_uid: contentType,
            environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production',
            limit: 10
        });
        queryType = 'entries';
    } else {
        console.log('🔍 Determining content type...');
        const detectedContentType = this.fastContentTypeDetection(userMessage);
        console.log(`🔍 Smart searching in "${detectedContentType}" content type...`);
        relevantContent = await this.mcpClient.searchContent(userMessage, detectedContentType);
    }

    // Add a fallback in case relevantContent is still empty
    if (!relevantContent) {
        console.log('⚠️ No content found, using fallback search...');
        relevantContent = await this.mcpClient.searchContent(userMessage, 'product');
    }

    // Use the passed history for context building
    const context = this.buildConversationContext(relevantContent, queryType, history);
    console.log('🤖 Generating response...');
    const response = await this.model.invoke(context);
    const assistantResponse = this.cleanResponse(response);
    history.push({ role: 'assistant', content: assistantResponse });
    this.conversationHistory = [...history];

    // Keep history manageable
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

private buildConversationContext(contentstackData: string, queryType?: string, history: ChatMessage[] = []): string {
  // Use the provided history or fallback to internal history
  const effectiveHistory = history.length > 0 ? history : this.conversationHistory;
  
  const historyContext = effectiveHistory
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');

  let instructions = `
You are a helpful Contentstack assistant. Answer the user's question based on the content from our website.

CONVERSATION HISTORY:
${historyContext}

CONTENTSTACK CONTENT:
${contentstackData}

CURRENT USER QUESTION: ${effectiveHistory[effectiveHistory.length - 1]?.content}

INSTRUCTIONS:
1. Answer based ONLY on the Contentstack content provided
2. Be conversational and helpful
3. If you don't know the answer, say so
4. Keep responses concise but informative
5. Maintain the conversation context
6. NEVER use markdown formatting like **bold** or _italic_ text
7. Always respond with plain, clean text only
`;

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
    if (this.reindexInterval) {
      clearInterval(this.reindexInterval);
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
}






// src/search-service.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { ContentIndexItem } from './generate-content-index.js';

export class SearchService {
  private contentIndex: ContentIndexItem[] = [];

  async initialize(): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const filePath = path.join(process.cwd(), 'content_index.json');
        const data = await fs.readFile(filePath, 'utf-8');
        
        // Check if file is empty or contains only whitespace
        if (!data.trim()) {
          throw new Error('File is empty');
        }
        
        this.contentIndex = JSON.parse(data);
        console.log(`✅ Loaded content index with ${this.contentIndex.length} items`);
        return; // Success, exit the function
      } catch (error) {
        if (attempt === maxRetries) {
          console.error('❌ Failed to load content index after multiple attempts:', error);
          this.contentIndex = [];
          return;
        }
        
        console.log(`⚠️  Failed to load content index (attempt ${attempt}/${maxRetries}), retrying...`);
        await this.delay(retryDelay * attempt); // Wait longer between retries
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ADD THIS METHOD to fix the error
  findBestMatch(query: string): ContentIndexItem | null {
    if (this.contentIndex.length === 0) {
      return null;
    }

    const queryLower = query.toLowerCase();
    
    // First, try exact title matches
    const exactMatch = this.contentIndex.find(item => 
      item.title.toLowerCase() === queryLower
    );
    
    if (exactMatch) {
      return exactMatch;
    }

    // Then try contains matches
    const containsMatch = this.contentIndex.find(item => 
      item.title.toLowerCase().includes(queryLower) ||
      (item.description && item.description.toLowerCase().includes(queryLower))
    );
    
    if (containsMatch) {
      return containsMatch;
    }

    // Finally, try word-based matching
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    
    let bestMatch: ContentIndexItem | null = null;
    let bestScore = 0;

    for (const item of this.contentIndex) {
      const itemText = `${item.title} ${item.description || ''}`.toLowerCase();
      let score = 0;
      
      for (const word of queryWords) {
        if (itemText.includes(word)) {
          score++;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }
    
    return bestMatch;
  }

  async search(query: string, limit: number = 5): Promise<ContentIndexItem[]> {
    if (this.contentIndex.length === 0) {
      return [];
    }

    const queryLower = query.toLowerCase();
    
    const results = this.contentIndex.filter(item => {
      const searchText = `${item.title} ${item.description || ''}`.toLowerCase();
      return searchText.includes(queryLower) || queryLower.includes(item.title.toLowerCase());
    });

    return results.slice(0, limit);
  }

  findEntryById(uid: string): ContentIndexItem | undefined {
    return this.contentIndex.find(item => item.uid === uid);
  }

  findEntriesByType(contentType: string): ContentIndexItem[] {
    return this.contentIndex.filter(item => item.contentType === contentType);
  }

  // Also add this method if you're using initializeWithData
  async initializeWithData(data: ContentIndexItem[]): Promise<void> {
    this.contentIndex = data;
    console.log(`✅ Loaded content index with ${this.contentIndex.length} items`);
  }


 getAllItems(): ContentIndexItem[] {
  return [...this.contentIndex]; // Return a copy of all items
}
}