import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { ContentstackMCPClient } from './mcp-client.js';
import { ChatMessage } from './chat-agent.js';

export class DynamicContentRouter {
  private model: BaseLanguageModel;
  private mcpClient: ContentstackMCPClient;
  private availableContentTypes: string[];

  constructor(
    model: BaseLanguageModel,
    mcpClient: ContentstackMCPClient,
    contentTypes: string[] = []
  ) {
    this.model = model;
    this.mcpClient = mcpClient;
    this.availableContentTypes = contentTypes;
  }

  updateContentTypes(contentTypes: string[]): void {
    this.availableContentTypes = contentTypes;
  }

  async determineIfContentNeeded(userMessage: string): Promise<boolean> {
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
      console.log('💬 Detected general conversation pattern');
      return false;
    }

    const context = `
Analyze the user's message and determine if it requires accessing specific information from a content database.

USER MESSAGE: "${userMessage}"

INSTRUCTIONS:
1. Return ONLY "true" or "false" (no other text)
2. Return "true" if the user is asking about:
   - Specific information (contact details, policies, products, services)
   - Company information (address, phone, email, hours)
   - How-to questions or instructions
   - Product details, prices, availability
   - Policies (return, shipping, privacy)
   - Any factual information that might be stored in a database
3. Return "false" ONLY for:
   - General greetings and farewells
   - Small talk about feelings/emotions
   - Simple acknowledgments
   - Compliments without specific questions

EXAMPLES:
- "What's the return policy?" → true
- "How can I contact support?" → true
- "Do you have blue shoes?" → true  
- "What's your address?" → true
- "Hi there!" → false
- "How are you today?" → false
- "Thanks for your help!" → false
- "You're very helpful" → false

RESPONSE:`.trim();

    try {
      const response = await this.model.invoke(context);
      const result = typeof response === 'string' ? response : response.content;
      const needsContent = result.trim().toLowerCase() === 'true';
      
      console.log(`🧠 LLM content determination: ${needsContent} for "${userMessage}"`);
      return needsContent;
    } catch (error) {
      console.error('❌ Error determining if content is needed:', error);
      const isDefinitelyGeneral = lowerMessage.match(/^(hi|hello|hey|thanks|thank you|bye|goodbye|how are you|you're welcome)/i);
      return !isDefinitelyGeneral;
    }
  }

  async routeQuery(userMessage: string, history: ChatMessage[] = []): Promise<string> {
    if (this.availableContentTypes.length === 0) {
      return "No content types available to search.";
    }

    const bestContentType = await this.selectContentType(userMessage);
    
    console.log(`🧠 LLM selected content type: ${bestContentType}`);

    // CHECK IF USING GROQ AND BYPASS NORMAL SEARCH TO PREVENT RETRIES
    const isGroq = this.isGroqModel();
    
    if (isGroq) {
      console.log('🚀 Using direct GROQ-optimized search (bypassing retry mechanism)');
      return await this.handleGroqQueryDirect(userMessage, bestContentType, history);
    }

    // Original code for other providers
    try {
      const searchResult = await this.mcpClient.searchContent(userMessage, bestContentType);
      
      if (!searchResult || searchResult.includes('Unable to') || searchResult.includes('No content')) {
        return await this.handleNoResults(userMessage, bestContentType, history);
      }

      return this.generateResponseFromContent(searchResult, userMessage, history);
    } catch (error: any) {
      console.error('❌ Error searching content:', error);
      
      // Handle token limit errors for other providers
      if (this.isTokenLimitError(error)) {
        console.log('🔥 Token limit exceeded, optimizing query...');
        return await this.handleTokenLimitError(userMessage, bestContentType, history);
      }
      
      return await this.handleGenericError(userMessage, history);
    }
  }

  // ADD THIS METHOD TO BYPASS RETRY MECHANISM FOR GROQ
  private async handleGroqQueryDirect(
    userMessage: string, 
    contentType: string, 
    history: ChatMessage[]
  ): Promise<string> {
    try {
      console.log('🔍 Using direct GROQ-optimized search');
      // Use smartSearchContent if available, otherwise fallback to optimized search
      let searchResult: string;
      
      if (typeof (this.mcpClient as any).smartSearchContent === 'function') {
        searchResult = await (this.mcpClient as any).smartSearchContent(userMessage, contentType, 'groq');
      } else {
        // Fallback to optimized search
        const optimizedQuery = this.optimizeQueryForTokenLimit(userMessage);
        searchResult = await this.mcpClient.searchContent(optimizedQuery, contentType);
      }
      
      if (this.isValidSearchResult(searchResult, userMessage)) {
        return this.generateResponseFromContent(searchResult, userMessage, history);
      }
      
      return await this.handleNoResults(userMessage, contentType, history);
    } catch (error: any) {
      console.error('❌ Error in direct GROQ search:', error);
      
      // Even if direct search fails, don't retry - provide immediate response
      if (this.isTokenLimitError(error)) {
        return this.getTokenLimitFallbackResponse(userMessage);
      }
      
      return await this.handleGenericError(userMessage, history);
    }
  }

  // ADD THIS HELPER METHOD
  private isGroqModel(): boolean {
    // Check if we're using GROQ
    const model = this.model as any;
    return model?.lc_kwargs?.modelName?.includes('llama') || 
           model?.constructor?.name?.toLowerCase().includes('groq') ||
           (model?.model && model.model.includes('llama'));
  }

 private isValidSearchResult(result: string, originalQuery: string): boolean {
    return (
        result.length > 10 && 
        !result.includes('Unable to') && 
        !result.includes('No content') &&
        !result.includes('No relevant results')
    );
}

  private getTokenLimitFallbackResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
      return "For current pricing information, please visit our website or contact customer service for the most accurate details.";
    }
    
    if (lowerMessage.includes('product') || lowerMessage.includes('item')) {
      return "I'm having trouble accessing our product catalog right now. Please check our online store or contact us for product information.";
    }
    
    return "I'm experiencing temporary technical limitations. Please try again shortly or contact us for immediate assistance.";
  }

  // Add this method to handle GROQ token limit errors specifically
  private isTokenLimitError(error: any): boolean {
    return error?.status === 413 && 
           error?.error?.code === 'rate_limit_exceeded' &&
           error?.error?.message?.includes('Request too large for model');
  }

  // Add this method to handle token limit errors
  private async handleTokenLimitError(
    userMessage: string, 
    originalContentType: string, 
    history: ChatMessage[]
  ): Promise<string> {
    try {
      // Strategy 1: Optimize the query
      const optimizedQuery = this.optimizeQueryForTokenLimit(userMessage);
      console.log(`🔄 Trying optimized query: "${optimizedQuery}"`);
      
      const optimizedResult = await this.mcpClient.searchContent(optimizedQuery, originalContentType);
      if (optimizedResult && !optimizedResult.includes('Unable to')) {
        return this.generateResponseFromContent(optimizedResult, userMessage, history);
      }

      // Strategy 2: Try related content types
      const relatedTypes = this.getRelatedContentTypes(originalContentType);
      for (const contentType of relatedTypes) {
        try {
          console.log(`🔄 Trying related content type: ${contentType}`);
          const result = await this.mcpClient.searchContent(userMessage, contentType);
          if (result && !result.includes('Unable to')) {
            return this.generateResponseFromContent(result, userMessage, history);
          }
        } catch (error) {
          continue;
        }
      }

      return "I'm having trouble accessing our product database right now. Please try asking about specific products or contact customer service for detailed information.";

    } catch (error) {
      console.error('❌ Error in token limit handler:', error);
      return await this.handleGenericError(userMessage, history);
    }
  }

  // Add this method to optimize queries for token limits
  private optimizeQueryForTokenLimit(query: string): string {
    // Extract key terms to reduce token usage
    const keyTerms = query.split(' ')
      .filter(term => term.length > 3) // Remove short words
      .slice(0, 3); // Limit to 3 key terms
    
    return keyTerms.join(' ');
  }

  // Add this method to get related content types
  private getRelatedContentTypes(originalType: string): string[] {
    const contentTypeRelations: Record<string, string[]> = {
      'product': ['collections', 'categories', 'faqs'],
      'faqs': ['product', 'policies', 'shipping_policies'],
      'shipping_policies': ['faqs', 'return_policies'],
      'collections': ['product', 'categories']
    };
    
    return contentTypeRelations[originalType] || 
           this.availableContentTypes.filter(type => type !== originalType);
  }

  // Update the handleNoResults method
  private async handleNoResults(
    userMessage: string, 
    originalContentType: string, 
    history: ChatMessage[]
  ): Promise<string> {
    console.log(`❌ No results in ${originalContentType}, trying other content types...`);
    
    // Try other content types in priority order
    const priorityOrder = this.getSearchPriority(originalContentType);
    
    for (const contentType of priorityOrder) {
      if (contentType !== originalContentType) {
        try {
          console.log(`🔄 Trying alternative content type: ${contentType}`);
          const result = await this.mcpClient.searchContent(userMessage, contentType);
          if (result && !result.includes('Unable to')) {
            console.log(`✅ Found results in ${contentType}`);
            return this.generateResponseFromContent(result, userMessage, history);
          }
        } catch (error) {
          console.log(`❌ Error searching in ${contentType}:`, error);
          continue;
        }
      }
    }
    
    return "I couldn't find specific information about that. Could you try asking in a different way or be more specific?";
  }

  // Add this method to get search priority
  private getSearchPriority(originalType: string): string[] {
    const priorityMap: Record<string, string[]> = {
      'product': ['collections', 'categories', 'faqs', ...this.availableContentTypes],
      'faqs': ['product', 'policies', 'shipping_policies', ...this.availableContentTypes],
      'default': this.availableContentTypes.filter(type => type !== originalType)
    };
    
    return priorityMap[originalType] || priorityMap.default;
  }

  // Add this method to handle generic errors
  private async handleGenericError(userMessage: string, history: ChatMessage[]): Promise<string> {
    // Simple fallback response without content search
    const context = `
The user asked: "${userMessage}"

I encountered a technical error while searching for information. Provide a helpful response that:
1. Acknowledges the issue politely
2. Suggests alternative ways to get information
3. Doesn't mention technical details
4. Is under 50 words

Response:`.trim();

    try {
      const response = await this.model.invoke(context);
      return this.cleanResponse(response);
    } catch (error) {
      return "I'm having trouble accessing our information right now. Please try again later or contact customer service for assistance.";
    }
  }

  // Add this cleanResponse method
  private cleanResponse(response: any): string {
    let content: string;
    if (typeof response === 'string') {
      content = response;
    } else if (response && typeof response.content === 'string') {
      content = response.content;
    } else {
      content = String(response);
    }
    
    return content
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .trim();
  }

  private async selectContentType(userMessage: string): Promise<string> {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('contact') || 
        lowerMessage.includes('email') || 
        lowerMessage.includes('phone') || 
        lowerMessage.includes('address') ||
        lowerMessage.includes('call') ||
        lowerMessage.includes('reach') ||
        lowerMessage.includes('get in touch')) {
      const contactTypes = this.availableContentTypes.filter(type => 
        type.toLowerCase().includes('contact') || 
        type.toLowerCase().includes('info') ||
        type.toLowerCase().includes('company') ||
        type.toLowerCase().includes('about') ||
        type.toLowerCase().includes('faq')
      );
      
      if (contactTypes.length > 0) {
        return contactTypes[0];
      }
    }
    
    const context = `
Analyze the user's question and select the most appropriate content type from the available options.

USER QUESTION: "${userMessage}"

AVAILABLE CONTENT TYPES: ${this.availableContentTypes.join(', ')}

INSTRUCTIONS:
1. Return ONLY the content type name (no other text)
2. Choose the content type that most likely contains the answer
3. Consider the context and intent of the question
4. For contact information, choose content types like "contact", "company_info", or "faq"
5. If unsure, choose the most general content type

EXAMPLES:
- "What's your return policy?" → "policies" or "return_policy"
- "Do you ship to Canada?" → "shipping" or "shipping_policies"  
- "How do I find my ring size?" → "size_guide" or "faq"
- "How can I contact you?" → "contact" or "company_info" or "faq"
- "What's your email address?" → "contact" or "company_info"
- "What products do you have?" → "products" or "catalog"
- "Tell me about your company" → "about" or "company_info"

RESPONSE:`.trim();

    try {
      const response = await this.model.invoke(context);
      let selectedType = typeof response === 'string' ? response : response.content;
      selectedType = selectedType.trim();

      if (this.availableContentTypes.includes(selectedType)) {
        return selectedType;
      }

      const closestMatch = this.findClosestContentType(selectedType);
      return closestMatch || this.availableContentTypes[0];
    } catch (error) {
      console.error('❌ Error selecting content type:', error);
      return this.availableContentTypes[0];
    }
  }

  private findClosestContentType(requestedType: string): string | null {
    const lowerRequested = requestedType.toLowerCase();
    
    for (const contentType of this.availableContentTypes) {
      if (contentType.toLowerCase() === lowerRequested) {
        return contentType;
      }
    }
    
    for (const contentType of this.availableContentTypes) {
      if (contentType.toLowerCase().includes(lowerRequested) || 
          lowerRequested.includes(contentType.toLowerCase())) {
        return contentType;
      }
    }
    
    const requestedWords = lowerRequested.split(/[^a-z0-9]+/).filter(Boolean);
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    for (const contentType of this.availableContentTypes) {
      const contentWords = contentType.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      let score = 0;
      
      for (const reqWord of requestedWords) {
        for (const contWord of contentWords) {
          if (contWord.includes(reqWord) || reqWord.includes(contWord)) {
            score++;
            break;
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = contentType;
      }
    }
    
    return bestMatch;
  }

  private async generateResponseFromContent(content: string, userMessage: string, history: ChatMessage[] = []): Promise<string> {
    const historyContext = history
      .slice(-3)
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    const context = `
You are a helpful assistant. Answer the user's question based on the content below.

CONVERSATION HISTORY:
${historyContext}

CONTENT DATA:
${content}

USER QUESTION: ${userMessage}

INSTRUCTIONS:
1. Answer based ONLY on the content provided
2. Be helpful and informative
3. If the content doesn't answer the question, say so politely
4. Keep response concise (under 100 words)
5. No markdown formatting
6. Don't mention content types or technical details
7. If contact information is requested, provide specific details from the content

YOUR RESPONSE:`.trim();

    const response = await this.model.invoke(context);
    
    let cleanResponse = typeof response === 'string' ? response : response.content;
    cleanResponse = cleanResponse
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return cleanResponse;
  }
}