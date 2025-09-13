// src/streaming-chat-agent.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ContentstackMCPClient } from './mcp-client.js';
import * as dotenv from 'dotenv';
import { HumanMessage } from '@langchain/core/messages';

dotenv.config();

export class StreamingContentstackChatAgent {
  private model: ChatGoogleGenerativeAI;
  private mcpClient: ContentstackMCPClient;
  private conversationHistory: any[] = [];

  constructor() {
    this.model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY!,
      model: 'gemini-2.5-flash', // ⚡ Faster model
      temperature: 0.3, // Less creative, more focused
    });

    this.mcpClient = new ContentstackMCPClient();
  }

  async initialize(): Promise<void> {
    console.log('🤖 Initializing Streaming Chat Agent...');
    await this.mcpClient.connect();
    console.log('✅ Streaming Chat Agent ready!');
  }

  // Fix: Properly handle different content types
  private extractContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    } else if (Array.isArray(content)) {
      // Handle complex content arrays by extracting text
      return content
        .map(item => {
          if (typeof item === 'string') return item;
          if (item && typeof item.text === 'string') return item.text;
          if (item && typeof item.content === 'string') return item.content;
          return '';
        })
        .filter(text => text.length > 0)
        .join(' ');
    }
    return '';
  }

  async *sendMessageStream(userMessage: string): AsyncGenerator<string> {
    try {
      this.conversationHistory.push(new HumanMessage(userMessage));
      
      // 1. Immediate response start
      yield "🤖 Thinking...\n";
      
      // 2. Check if general message (fast path)
      if (this.isGeneralMessage(userMessage)) {
        const stream = await this.model.stream(this.conversationHistory);
        for await (const chunk of stream) {
          // FIX: Handle different content types properly
          const content = this.extractContent(chunk.content);
          if (content) {
            yield content;
          }
        }
        return;
      }

      // 3. Get content from MCP (show progress)
      yield "🔍 Searching content...\n";
      const content = await this.getRelevantContent(userMessage);
      
      // 4. Stream the response with content context
      const prompt = this.buildPromptWithContent(userMessage, content);
      const stream = await this.model.stream([new HumanMessage(prompt)]);
      
      for await (const chunk of stream) {
        // FIX: Handle different content types properly
        const contentChunk = this.extractContent(chunk.content);
        if (contentChunk) {
          yield contentChunk;
        }
      }

    } catch (error) {
      console.error('Streaming error:', error);
      yield "❌ Sorry, I encountered an error. Please try again.";
    }
  }

  private async getRelevantContent(userMessage: string): Promise<string> {
    const cleaned = userMessage.toLowerCase().trim();
    
    if (cleaned.includes('asset') || cleaned.includes('image') || cleaned.includes('file')) {
      try {
        const environments = await this.mcpClient.callTool('get_all_environments', {});
        const envData = JSON.parse(environments);
        const availableEnv = envData.environments && envData.environments.length > 0 
          ? envData.environments[0].name 
          : 'production';
        
        return await this.mcpClient.callTool('get_all_assets', {
          environment: availableEnv,
          limit: 5
        });
      } catch (error) {
        return await this.mcpClient.callTool('get_all_assets', {
          environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production',
          limit: 5
        });
      }
    } else if (cleaned.includes('content type') || cleaned.includes('content-type')) {
      return await this.mcpClient.callTool('get_all_content_types', {});
    } else if (cleaned.includes('entr')) {
      const contentTypeMatch = userMessage.match(/(page|blog|article|product)/i);
      const contentType = contentTypeMatch ? contentTypeMatch[1].toLowerCase() : 'page';
      return await this.mcpClient.callTool('get_all_entries', { 
        content_type_uid: contentType,
        environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production',
        limit: 5
      });
    } else {
      const detectedType = await this.determineContentType(userMessage);
      return await this.mcpClient.searchContent(userMessage, detectedType);
    }
  }

  private isGeneralMessage(message: string): boolean {
    const generalPatterns = [
      /^(hi|hello|hey|greetings)/i,
      /^(thanks|thank you)/i,
      /^(who are you|what can you do)/i,
      /^(bye|goodbye|exit|quit)/i,
      /^(help|support)/i
    ];
    return generalPatterns.some(pattern => pattern.test(message.toLowerCase().trim()));
  }

  private async determineContentType(userQuery: string): Promise<string> {
    const query = userQuery.toLowerCase();
    
    // Fast keyword matching
    if (query.includes('product')) return 'product';
    if (query.includes('blog')) return 'blog_post';
    if (query.includes('article')) return 'article';
    if (query.includes('faq') || query.includes('question')) return 'faq';
    if (query.includes('user') || query.includes('author')) return 'author';
    
    return 'page'; // default
  }

  private buildPromptWithContent(userMessage: string, content: string): string {
    return `
Answer the user's question based on this content. Be concise and direct.

CONTENT:
${content}

USER QUESTION: ${userMessage}

Respond conversationally without markdown formatting. If no relevant content found, say so politely.
`;
  }

  async shutdown(): Promise<void> {
    await this.mcpClient.disconnect();
    console.log('🔌 Streaming Chat Agent shutdown');
  }
}