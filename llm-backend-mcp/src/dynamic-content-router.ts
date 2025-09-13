// src/dynamic-content-router.ts
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

  // Update available content types
  updateContentTypes(contentTypes: string[]): void {
    this.availableContentTypes = contentTypes;
  }

  // IMPROVED intent detection - better at identifying content needs
  async determineIfContentNeeded(userMessage: string): Promise<boolean> {
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
      console.log('💬 Detected general conversation pattern');
      return false;
    }

    // Use LLM for ambiguous cases - but be more aggressive about content detection
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
      // Fallback: be more aggressive about content detection
      // Assume content is needed for anything that's not obviously general
      const isDefinitelyGeneral = lowerMessage.match(/^(hi|hello|hey|thanks|thank you|bye|goodbye|how are you|you're welcome)/i);
      return !isDefinitelyGeneral;
    }
  }

  // Route query to the appropriate content type
  async routeQuery(userMessage: string, history: ChatMessage[] = []): Promise<string> {
    if (this.availableContentTypes.length === 0) {
      return "No content types available to search.";
    }

    // First, determine the best content type using LLM
    const bestContentType = await this.selectContentType(userMessage);
    
    console.log(`🧠 LLM selected content type: ${bestContentType}`);

    // Search in the selected content type
    try {
      const searchResult = await this.mcpClient.searchContent(userMessage, bestContentType);
      
      if (!searchResult || searchResult.includes('Unable to') || searchResult.includes('No content')) {
        console.log(`❌ No results in ${bestContentType}, trying other content types...`);
        
        // If no results in the selected type, try other types
        for (const contentType of this.availableContentTypes) {
          if (contentType !== bestContentType) {
            console.log(`🔄 Trying fallback content type: ${contentType}`);
            const fallbackResult = await this.mcpClient.searchContent(userMessage, contentType);
            if (fallbackResult && !fallbackResult.includes('Unable to') && !fallbackResult.includes('No content')) {
              console.log(`✅ Found results in fallback type: ${contentType}`);
              return this.generateResponseFromContent(fallbackResult, userMessage, history);
            }
          }
        }
        return "I couldn't find specific information about that. Could you try asking in a different way?";
      }

      return this.generateResponseFromContent(searchResult, userMessage, history);
    } catch (error) {
      console.error('❌ Error searching content:', error);
      return "I encountered an error while searching for information. Please try again.";
    }
  }

  // IMPROVED content type selection with better contact detection
  private async selectContentType(userMessage: string): Promise<string> {
    const lowerMessage = userMessage.toLowerCase();
    
    // Quick detection for common query types before using LLM
    if (lowerMessage.includes('contact') || 
        lowerMessage.includes('email') || 
        lowerMessage.includes('phone') || 
        lowerMessage.includes('address') ||
        lowerMessage.includes('call') ||
        lowerMessage.includes('reach') ||
        lowerMessage.includes('get in touch')) {
      // Look for contact-related content types first
      const contactTypes = this.availableContentTypes.filter(type => 
        type.toLowerCase().includes('contact') || 
        type.toLowerCase().includes('info') ||
        type.toLowerCase().includes('company') ||
        type.toLowerCase().includes('about') ||
        type.toLowerCase().includes('faq')
      );
      
      if (contactTypes.length > 0) {
        return contactTypes[0]; // Return the first matching contact type
      }
    }
    
    // Use LLM for other cases
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

      // Validate that the selected type is available
      if (this.availableContentTypes.includes(selectedType)) {
        return selectedType;
      }

      // If the LLM returned an invalid type, find the closest match
      const closestMatch = this.findClosestContentType(selectedType);
      return closestMatch || this.availableContentTypes[0];
    } catch (error) {
      console.error('❌ Error selecting content type:', error);
      // Fallback to first available type
      return this.availableContentTypes[0];
    }
  }

  // Find the closest matching content type
  private findClosestContentType(requestedType: string): string | null {
    const lowerRequested = requestedType.toLowerCase();
    
    // First try exact match
    for (const contentType of this.availableContentTypes) {
      if (contentType.toLowerCase() === lowerRequested) {
        return contentType;
      }
    }
    
    // Then try partial match
    for (const contentType of this.availableContentTypes) {
      if (contentType.toLowerCase().includes(lowerRequested) || 
          lowerRequested.includes(contentType.toLowerCase())) {
        return contentType;
      }
    }
    
    // Then try word-based matching
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

  // Generate response from content
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
    
    // Clean the response
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