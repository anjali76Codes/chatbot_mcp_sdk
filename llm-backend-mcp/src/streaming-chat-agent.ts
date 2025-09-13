// // src/streaming-chat-agent.ts
// import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
// import { ContentstackMCPClient } from './mcp-client.js';
// import * as dotenv from 'dotenv';
// import { HumanMessage } from '@langchain/core/messages';
// import { ChatMessage } from './chat-agent.js';

// dotenv.config();

// export interface StreamingChatAgentConfig {
//   contentstack?: {
//     apiKey?: string;
//     deliveryToken?: string;
//     environment?: string;
//     region?: string;
//   };
  
//   llm?: {
//     provider: 'google' | 'openai' | 'anthropic' | 'groq';
//     apiKey?: string;
//     model?: string;
//     temperature?: number;
//   };
// }

// export class StreamingContentstackChatAgent {
//   private model: ChatGoogleGenerativeAI;
//   private mcpClient: ContentstackMCPClient | null = null;
//   private conversationHistory: ChatMessage[] = [];
//   private config: StreamingChatAgentConfig;
//   private isMCPInitialized: boolean = false;
//   private availableContentTypes: string[] = [];
//   private contentTypeMappings: Map<string, string[]> = new Map();

//   constructor(config: StreamingChatAgentConfig = {}) {
//     this.config = config;
    
//     const llmApiKey = config.llm?.apiKey || process.env.GOOGLE_API_KEY!;
//     const llmModel = config.llm?.model || 'gemini-2.5-flash';
//     const llmTemperature = config.llm?.temperature || 0.3;

//     this.model = new ChatGoogleGenerativeAI({
//       apiKey: llmApiKey,
//       model: llmModel,
//       temperature: llmTemperature,
//     });

//     // Initialize content type mappings
//     this.initializeContentTypeMappings();

//     const apiKey = config.contentstack?.apiKey || process.env.CONTENTSTACK_API_KEY;
//     const deliveryToken = config.contentstack?.deliveryToken || process.env.CONTENTSTACK_DELIVERY_TOKEN;
//     const environment = config.contentstack?.environment || process.env.CONTENTSTACK_ENVIRONMENT || 'production';
//     const region = config.contentstack?.region || process.env.CONTENTSTACK_REGION || 'us';

//     if (apiKey && deliveryToken) {
//       console.log('🔑 MCP credentials found, initializing client...');
//       this.mcpClient = new ContentstackMCPClient({
//         apiKey: apiKey,
//         managementToken: deliveryToken,
//         environment: environment,
//         region: region
//       });
//     } else {
//       console.log('❌ MCP not configured: Missing API key or delivery token');
//     }
//   }

//   private initializeContentTypeMappings(): void {
//     // Map keywords to content types for better routing
//     this.contentTypeMappings.set('product', [
//       'product', 'ring', 'jewelry', 'item', 'collection', 'price', 'buy', 'purchase',
//       'feature', 'specification', 'material', 'gemstone', 'diamond', 'gold', 'silver'
//     ]);
    
//     this.contentTypeMappings.set('policy', [
//       'policy', 'return', 'refund', 'warranty', 'guarantee', 'shipping', 'delivery',
//       'terms', 'condition', 'privacy', 'security', 'faq', 'help', 'support'
//     ]);
    
//     this.contentTypeMappings.set('page', [
//       'about', 'contact', 'home', 'landing', 'information', 'details', 'company',
//       'story', 'mission', 'vision', 'team'
//     ]);
//   }

//   async initialize(): Promise<void> {
//     console.log('🤖 Initializing Streaming Chat Agent...');
    
//     if (this.mcpClient) {
//       try {
//         console.log('🔗 Attempting to connect to MCP...');
//         await this.mcpClient.connect();
//         this.isMCPInitialized = true;
        
//         // Get available content types for better routing
//         await this.getAvailableContentTypes();
        
//         console.log('✅ MCP connected successfully for streaming');
//       } catch (error) {
//         console.error('❌ MCP connection failed:', error);
//         console.log('⚠️ MCP will not be available for streaming');
//         this.mcpClient = null;
//         this.isMCPInitialized = false;
//       }
//     } else {
//       console.log('ℹ️ No MCP client configured - running in LLM-only streaming mode');
//     }
    
//     console.log('✅ Streaming Chat Agent ready!');
//   }

//   private async getAvailableContentTypes(): Promise<string[]> {
//     if (!this.mcpClient || !this.isMCPInitialized) {
//       return [];
//     }

//     try {
//       const contentTypesResponse = await this.mcpClient.callTool('get_all_content_types', {});
//       const contentTypesData = JSON.parse(contentTypesResponse);
      
//       if (contentTypesData && Array.isArray(contentTypesData.content_types)) {
//         this.availableContentTypes = contentTypesData.content_types
//           .map((ct: any) => ct.uid)
//           .filter(Boolean);
        
//         console.log(`📋 Found ${this.availableContentTypes.length} content types:`, this.availableContentTypes);
//         return this.availableContentTypes;
//       }
      
//       return [];
//     } catch (error) {
//       console.error('❌ Error getting content types:', error);
//       return [];
//     }
//   }

//   private determineContentType(userMessage: string): string | null {
//     const message = userMessage.toLowerCase();
    
//     // Check against our keyword mappings first
//     for (const [contentType, keywords] of this.contentTypeMappings) {
//       if (keywords.some(keyword => message.includes(keyword)) && 
//           this.availableContentTypes.includes(contentType)) {
//         console.log(`🎯 Content type detected: ${contentType} (keyword matching)`);
//         return contentType;
//       }
//     }
    
//     // If no keyword match, try to find the best content type based on available ones
//     const availableTypes = this.availableContentTypes;
    
//     // Simple heuristic matching
//     if (message.includes('policy') || message.includes('return') || message.includes('refund')) {
//       const policyType = availableTypes.find(type => 
//         type.includes('policy') || type.includes('term') || type.includes('faq')
//       );
//       if (policyType) {
//         console.log(`🎯 Content type detected: ${policyType} (heuristic matching)`);
//         return policyType;
//       }
//     }
    
//     if (message.includes('product') || message.includes('ring') || message.includes('item')) {
//       const productType = availableTypes.find(type => 
//         type.includes('product') || type.includes('item') || type.includes('collection')
//       );
//       if (productType) {
//         console.log(`🎯 Content type detected: ${productType} (heuristic matching)`);
//         return productType;
//       }
//     }
    
//     // Default to first available content type if none matched
//     if (availableTypes.length > 0) {
//       console.log(`🎯 Defaulting to content type: ${availableTypes[0]}`);
//       return availableTypes[0];
//     }
    
//     console.log('❌ No content type detected');
//     return null;
//   }

//   private extractContent(content: any): string {
//     if (typeof content === 'string') {
//       return content;
//     } else if (Array.isArray(content)) {
//       return content
//         .map(item => {
//           if (typeof item === 'string') return item;
//           if (item && typeof item.text === 'string') return item.text;
//           if (item && typeof item.content === 'string') return item.content;
//           return '';
//         })
//         .filter(text => text.length > 0)
//         .join(' ');
//     } else if (content && typeof content.content === 'string') {
//       return content.content;
//     } else if (content && typeof content.text === 'string') {
//       return content.text;
//     }
//     return String(content);
//   }

//   async *sendMessageStream(userMessage: string, history: ChatMessage[] = []): AsyncGenerator<string> {
//     try {
//       const userMessageObj: ChatMessage = { role: 'user', content: userMessage };
//       const currentHistory = [...history, userMessageObj];
//       this.conversationHistory = currentHistory;

//       // 1. Immediate response start
//       yield "🤖 Thinking...\n";
      
//       // 2. Check if general message (fast path)
//       if (this.isGeneralMessage(userMessage)) {
//         const context = this.buildGeneralContext(currentHistory);
//         const stream = await this.model.stream([new HumanMessage(context)]);
        
//         let fullResponse = '';
//         for await (const chunk of stream) {
//           const content = this.extractContent(chunk);
//           if (content) {
//             fullResponse += content;
//             yield content;
//           }
//         }
        
//         const assistantMessage: ChatMessage = { role: 'assistant', content: fullResponse };
//         this.conversationHistory.push(assistantMessage);
//         return;
//       }

//       // 3. If MCP not available, use LLM only
//       if (!this.mcpClient || !this.isMCPInitialized) {
//         yield "ℹ️ MCP not available - using general knowledge only\n";
//         const context = this.buildGeneralContext(currentHistory);
//         const stream = await this.model.stream([new HumanMessage(context)]);
        
//         let fullResponse = '';
//         for await (const chunk of stream) {
//           const content = this.extractContent(chunk);
//           if (content) {
//             fullResponse += content;
//             yield content;
//           }
//         }
        
//         const assistantMessage: ChatMessage = { role: 'assistant', content: fullResponse };
//         this.conversationHistory.push(assistantMessage);
//         return;
//       }

//       // 4. Get content from MCP (show progress)
//       yield "🔍 Searching content...\n";
      
//       try {
//         // await this.ensureMCPConnected();
        
//         // Determine the best content type for this query
//         const contentType = this.determineContentType(userMessage);
//         const content = await this.getRelevantContent(userMessage, contentType);
        
//         if (!content || content.includes('No content') || content.includes('Unable to')) {
//           yield "❌ I couldn't find relevant content for your question. Please try asking differently.";
//           return;
//         }

//         // 5. Stream the response with content context
//         const prompt = this.buildPromptWithContent(userMessage, content, currentHistory);
//         const stream = await this.model.stream([new HumanMessage(prompt)]);
        
//         let fullResponse = '';
//         for await (const chunk of stream) {
//           const contentChunk = this.extractContent(chunk);
//           if (contentChunk) {
//             fullResponse += contentChunk;
//             yield contentChunk;
//           }
//         }
        
//         const assistantMessage: ChatMessage = { role: 'assistant', content: fullResponse };
//         this.conversationHistory.push(assistantMessage);

//       } catch (error) {
//         console.error('❌ Error getting content:', error);
//         yield "❌ Sorry, I encountered an error while searching for content. Please try again.";
//       }

//     } catch (error) {
//       console.error('❌ Streaming error:', error);
//       yield "❌ Sorry, I encountered an error. Please try again.";
//     }
//   }

//   private async getRelevantContent(userMessage: string, preferredContentType?: string | null): Promise<string> {
//     if (!this.mcpClient) {
//       throw new Error('MCP client not available');
//     }

//     const cleaned = userMessage.toLowerCase().trim();
    
//     // Use preferred content type if provided
//     if (preferredContentType && this.availableContentTypes.includes(preferredContentType)) {
//       try {
//         console.log(`🛠️ Calling tool for content type: ${preferredContentType}`);
//         return await this.mcpClient.callTool('get_all_entries', {
//           content_type_uid: preferredContentType,
//           environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production',
//           limit: 10
//         });
//       } catch (error) {
//         console.error(`❌ Error fetching ${preferredContentType}:`, error);
//         // Fall through to other methods
//       }
//     }

//     // Simple content type detection for streaming (fast path)
//     if (cleaned.includes('asset') || cleaned.includes('image') || cleaned.includes('file')) {
//       try {
//         return await this.mcpClient.callTool('get_all_assets', {
//           environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production',
//           limit: 3
//         });
//       } catch (error) {
//         return "No assets found or error fetching assets.";
//       }
//     } else if (cleaned.includes('content type') || cleaned.includes('content-type')) {
//       try {
//         return await this.mcpClient.callTool('get_all_content_types', {});
//       } catch (error) {
//         return "Error fetching content types.";
//       }
//     } else if (cleaned.includes('environment') || cleaned.includes('env')) {
//       try {
//         return await this.mcpClient.callTool('get_all_environments', {});
//       } catch (error) {
//         return "Error fetching environments.";
//       }
//     } else {
//       // For general content, try to find the best content type
//       try {
//         // Try a few common content types first for faster response
//         const commonTypes = ['policy', 'faq', 'page', 'product', 'article'];
        
//         for (const contentType of commonTypes) {
//           if (this.availableContentTypes.includes(contentType)) {
//             const result = await this.mcpClient.callTool('get_all_entries', {
//               content_type_uid: contentType,
//               environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production',
//               limit: 20
//             });
            
//             if (result && !result.includes('No entries') && !result.includes('Unable to')) {
//               return result;
//             }
//           }
//         }
        
//         return "No relevant content found for your query.";
//       } catch (error) {
//         console.error('Error searching content:', error);
//         return "Error searching for content.";
//       }
//     }
//   }

//   private isGeneralMessage(message: string): boolean {
//     const generalPatterns = [
//       /^(hi|hello|hey|greetings|hola|bonjour|namaste|howdy)/i,
//       /^(thanks|thank you|thx|ty|appreciate)/i,
//       /^(who are you|what are you|what can you do|your name)/i,
//       /^(bye|goodbye|exit|quit|see ya|see you)/i,
//       /^(help|support|what can you help with)/i,
//       /^(yes|no|maybe|sure|ok|okay|alright)/i,
//       /^(how are you|how're you|how do you do)/i,
//       /^(good morning|good afternoon|good evening)/i
//     ];
//     return generalPatterns.some(pattern => pattern.test(message.toLowerCase().trim()));
//   }

//   private buildGeneralContext(history: ChatMessage[]): string {
//     const lastFewMessages = history.slice(-3);
    
//     const historyContext = lastFewMessages
//       .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
//       .join('\n');

//     return `
// You are a friendly and helpful AI assistant. Keep responses brief and conversational.

// CONVERSATION HISTORY:
// ${historyContext}

// INSTRUCTIONS:
// 1. Respond naturally to general conversation
// 2. Keep responses under 2 sentences
// 3. Be friendly and engaging
// 4. NEVER use markdown formatting
// 5. Always respond with plain, clean text only

// YOUR RESPONSE:`.trim();
//   }

//   private buildPromptWithContent(userMessage: string, content: string, history: ChatMessage[]): string {
//     const historyContext = history
//       .slice(-2)
//       .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
//       .join('\n');

//     return `
// Answer the user's question based on this content. Be concise and conversational.

// CONVERSATION HISTORY:
// ${historyContext}

// CONTENT:
// ${content}

// USER QUESTION: ${userMessage}

// INSTRUCTIONS:
// 1. Answer based on the content provided
// 2. Keep response under 100 words
// 3. Be conversational and helpful
// 4. If no relevant content found, say so politely
// 5. NEVER use markdown formatting
// 6. Always respond with plain, clean text only

// YOUR RESPONSE:`.trim();
//   }

//   getConversationHistory(): ChatMessage[] {
//     return [...this.conversationHistory];
//   }

//   clearConversationHistory(): void {
//     this.conversationHistory = [];
//     console.log('🗑️ Streaming conversation history cleared');
//   }

//   async shutdown(): Promise<void> {
//     if (this.mcpClient && this.isMCPInitialized) {
//       await this.mcpClient.disconnect();
//     }
//     console.log('🔌 Streaming Chat Agent shutdown');
//   }

//   getMCPStatus(): string {
//     if (!this.mcpClient) return 'Not configured';
//     if (!this.isMCPInitialized) return 'Configured but not connected';
//     return 'Connected and ready';
//   }
// }