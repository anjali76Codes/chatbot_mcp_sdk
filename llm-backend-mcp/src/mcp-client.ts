import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as dotenv from 'dotenv';

dotenv.config();

export interface MCPClientConfig {
  apiKey?: string;
  managementToken?: string;
  environment?: string;
  region?: string;
}

class MCPConnectionPool {
  private static instances: Map<string, ContentstackMCPClient> = new Map();
  
  static getInstance(config: MCPClientConfig): ContentstackMCPClient {
    const key = `${config.apiKey}:${config.environment}`;
    
    if (!this.instances.has(key)) {
      this.instances.set(key, new ContentstackMCPClient(config));
    }
    
    return this.instances.get(key)!;
  }
  
  static async cleanup(): Promise<void> {
    for (const instance of this.instances.values()) {
      await instance.disconnect();
    }
    this.instances.clear();
  }
}

export class ContentstackMCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private availableTools: string[] = [];
  private config: MCPClientConfig;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(config: MCPClientConfig = {}) {
    this.config = config;
    
    const apiKey = config.apiKey || process.env.CONTENTSTACK_API_KEY;
    const managementToken = config.managementToken || process.env.CONTENTSTACK_MANAGEMENT_TOKEN;
    const environment = config.environment || process.env.CONTENTSTACK_ENVIRONMENT;
    const region = config.region || process.env.CONTENTSTACK_REGION || 'eu';

    if (!apiKey || !managementToken) {
      throw new Error('❌ Contentstack API Key and Management Token are required');
    }

    const serverCommand = 'npx';
    const serverArgs = [
      '-y',
      '@contentstack/mcp',
      '--api-key', apiKey,
      '--management-token', managementToken,
      '--environment', environment || 'production',
      '--region', region
    ];

    console.log('🚀 Initializing MCP client with management token...');
    // console.log('   spawn args:', serverArgs);

    const env: Record<string, string> = {
      PATH: process.env.PATH || ''
    };

    this.transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
      env: env
    });

    this.client = new Client(
      {
        name: 'contentstack-chat-agent',
        version: '0.1',
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = (async () => {
      try {
        console.log('🔗 Connecting to Contentstack MCP server...');
        await this.client.connect(this.transport);
        this.isConnected = true;
        console.log('✅ MCP Client connected successfully');
        
        await this.discoverTools();
      } catch (error) {
        console.error('❌ Failed to connect to MCP server:', error);
        this.connectionPromise = null;
        throw new Error(`MCP connection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();

    return this.connectionPromise;
  }

  async discoverTools(): Promise<void> {
    try {
      const toolsResponse = await this.client.listTools();
      this.availableTools = toolsResponse.tools.map((tool: any) => tool.name);
      // console.log('🛠️ Available MCP Tools:', this.availableTools);
    } catch (error) {
      console.error('❌ Failed to discover tools:', error);
      this.availableTools = [];
    }
  }

  async callTool(toolName: string, parameters: any, timeoutMs: number = 5000): Promise<string> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      if (!this.availableTools.includes(toolName)) {
        throw new Error(`Tool '${toolName}' not available. Available tools: ${this.availableTools.join(', ')}`);
      }

      console.log(`🛠️ Calling tool: ${toolName}`, this.sanitizeLogParameters(parameters));
      
      const result = await Promise.race([
        this.client.callTool({
          name: toolName,
          arguments: parameters,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Tool ${toolName} timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);

      return this.extractResponseText(result);
      
    } catch (error) {
      console.error(`❌ Error calling tool ${toolName}:`, error);
      
      if (error instanceof Error) {
        if (error.message.includes('not available')) {
          throw error;
        }
        if (error.message.includes('timeout')) {
          throw new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`);
        }
      }
      
      throw new Error(`Failed to execute tool ${toolName}: ${error}`);
    }
  }

  private sanitizeLogParameters(parameters: any): any {
    const sanitized = { ...parameters };
    if (sanitized.apiKey) delete sanitized.apiKey;
    if (sanitized.token) delete sanitized.token;
    if (sanitized.managementToken) delete sanitized.managementToken;
    return sanitized;
  }

  private extractResponseText(result: any): string {
    if (!result) return '';

    if (result.content && Array.isArray(result.content)) {
      const contentText = result.content
        .map((item: any) => {
          if (typeof item.text === 'string') return item.text;
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') return JSON.stringify(item);
          return '';
        })
        .filter((text: string) => text.length > 0)
        .join('\n');

      if (contentText) {
        return contentText;
      }
    }

    return typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
  }

// In mcp-client.ts
async searchContent(query: string, contentType: string, limit: number = 20): Promise<string> {
    try {
        const params: any = {
            content_type_uid: contentType,
            environment: this.config.environment || 'production',
            query: query,
            limit: limit, // Use the limit parameter
            skip: 0,
            locale: 'en-us'
        };

        const response = await this.callTool('get_all_entries', params);
        return response;
    } catch (error) {
        console.error(`❌ Error searching content in ${contentType}:`, error);
        return `Unable to search content in ${contentType}`;
    }
}



// In mcp-client.ts - Update the smartSearchContent method
async smartSearchContent(query: string, contentType: string, providerType: string = 'google'): Promise<string> {
  const isGroq = providerType.toLowerCase().includes('groq');
  const isGemini = providerType.toLowerCase().includes('google');
  
  if (isGemini) {
    // Gemini can handle larger responses
    return await this.searchContent(query, contentType, 25);
  }
  
  if (isGroq) {
    // Use the optimized GROQ search strategy
    return await this.groqOptimizedSearch(query, contentType);
  }
  
  // Default for other providers
  return await this.searchContent(query, contentType, 20);
}
// In mcp-client.ts - Update groqOptimizedSearch method
private async groqOptimizedSearch(query: string, contentType: string): Promise<string> {
  console.log('🔍 Using GROQ-optimized search strategy');
  
  const searchSteps = this.getSearchStrategyForGroq(query);
  
  let bestResult = "No relevant results found";
  let bestRelevanceScore = 0;
  
  for (const step of searchSteps) {
    try {
      console.log(`🔄 GROQ Step ${step.step}: "${step.query}" with limit ${step.limit}`);
      const result = await this.searchContent(step.query, contentType, step.limit);
      
      if (this.isValidSearchResult(result, query)) {
        console.log(`✅ GROQ found potentially relevant results in step ${step.step}`);
        
        // Calculate relevance score (simple heuristic)
        const relevanceScore = this.calculateRelevanceScore(result, query);
        console.log(`📊 Relevance score: ${relevanceScore}`);
        
        if (relevanceScore > bestRelevanceScore) {
          bestResult = result;
          bestRelevanceScore = relevanceScore;
        }
        
        // If we have a very good match, return immediately
        if (relevanceScore > 0.7) {
          console.log(`🎯 Excellent match found, returning results from step ${step.step}`);
          return result;
        }
      } else {
        console.log(`⚠️ GROQ results not relevant in step ${step.step}, trying next`);
      }
      
    } catch (error: any) {
      if (this.isTokenLimitError(error)) {
        console.log('⚠️ GROQ token limit hit, trying next step with fewer tokens');
        continue;
      }
      console.error('❌ Error in GROQ search step:', error);
    }
  }
  
  return bestRelevanceScore > 0 ? bestResult : "No relevant results found with token-efficient search";
}

// Add this helper method to calculate relevance score
private calculateRelevanceScore(result: string, query: string): number {
  try {
    const data = JSON.parse(result);
    if (data && data.entries && Array.isArray(data.entries)) {
      const keywords = this.extractKeywords(query).split(' ');
      let totalScore = 0;
      
      data.entries.forEach((entry: any) => {
        const entryText = JSON.stringify(entry).toLowerCase();
        keywords.forEach(keyword => {
          if (keyword.length > 2 && entryText.includes(keyword.toLowerCase())) {
            totalScore += 0.3; // Score for each keyword match
          }
        });
        
        // Bonus for exact title matches
        if (entry.title && query.toLowerCase().includes(entry.title.toLowerCase())) {
          totalScore += 0.5;
        }
      });
      
      return Math.min(1.0, totalScore / data.entries.length);
    }
  } catch (error) {
    // Fallback: simple keyword counting
    const lowerResult = result.toLowerCase();
    const keywords = this.extractKeywords(query).split(' ');
    const matches = keywords.filter(keyword => 
      keyword.length > 2 && lowerResult.includes(keyword.toLowerCase())
    ).length;
    
    return matches / keywords.length;
  }
  
  return 0;
}

// In mcp-client.ts - Update extractKeywords method
private extractKeywords(query: string): string {
  // Enhanced stop words list
  const commonStopWords = new Set([
    'what', 'is', 'the', 'price', 'of', 'and', 'or', 'for', 'do', 'you', 
    'have', 'can', 'tell', 'me', 'about', 'which', 'collections', 'under',
    'your', 'are', 'there', 'any', 'please', 'could', 'would', 'should',
    'will', 'shall', 'might', 'may', 'must', 'can', 'could', 'would',
    'how', 'much', 'many', 'where', 'when', 'why', 'who', 'does',
    'show', 'list', 'give', 'find', 'looking', 'for', 'want', 'need'
  ]);
  
  // Extract meaningful keywords with better filtering
  const words = query.split(/\s+/)
    .map(word => word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .filter(word => word.length > 3) // Longer words are more meaningful
    .filter(word => !commonStopWords.has(word))
    .filter((word, index, array) => array.indexOf(word) === index);
  
  return words.slice(0, 4).join(' ') || this.getMainKeyword(query);
}

private getMainKeyword(query: string): string {
  // Dynamic keyword extraction without hardcoded categories
  const words = query.split(/\s+/)
    .map(word => word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .filter(word => word.length > 3); // Focus on longer, more specific words
  
  // Return the most specific (longest) word, or first word as fallback
  return words.sort((a, b) => b.length - a.length)[0] || words[0] || 'information';
}



// In mcp-client.ts - Update getSearchStrategyForGroq method
private getSearchStrategyForGroq(query: string): Array<{query: string, limit: number, step: number}> {
  const keywords = this.extractKeywords(query);
  const mainKeyword = this.getMainKeyword(query);
  
  console.log(`🔍 Extracted keywords: "${keywords}", Main keyword: "${mainKeyword}"`);
  
  // More aggressive search strategy for better results
  return [
    // Step 1: Specific product search
    { query: `"${mainKeyword}" product`, limit: 4, step: 1 },
    
    // Step 2: Broader category search
    { query: keywords, limit: 6, step: 2 },
    
    // Step 3: Collection/type search
    { query: `${mainKeyword} collection`, limit: 5, step: 3 },
    
    // Step 4: Fallback to general search
    { query: mainKeyword, limit: 8, step: 4 },
    
    // Step 5: Very broad search as last resort
    { query: "jewelry accessories", limit: 10, step: 5 }
  ];
}

// In mcp-client.ts - Update the isValidSearchResult method
private isValidSearchResult(result: string, originalQuery: string): boolean {
    if (!result || result.includes('Unable to') || result.includes('No content')) {
        return false;
    }
    
    // Parse the JSON response to check if it actually contains entries
    try {
        const data = JSON.parse(result);
        if (data && data.entries && Array.isArray(data.entries)) {
            // Check if we have actual entries with content
            const hasValidEntries = data.entries.some((entry: any) => 
                entry && (entry.title || entry.product_name || entry.name)
            );
            
            if (!hasValidEntries) {
                console.log('❌ No valid entries found in search results');
                return false;
            }
            
            // Additional relevance check - look for query keywords in entry titles
            const keywords = this.extractKeywords(originalQuery).split(' ');
            const hasRelevantEntries = data.entries.some((entry: any) => {
                const entryText = JSON.stringify(entry).toLowerCase();
                return keywords.some(keyword => 
                    keyword.length > 2 && entryText.includes(keyword.toLowerCase())
                );
            });
            
            console.log(`🔍 Relevance check: ${hasRelevantEntries ? 'Relevant' : 'Not relevant'}`);
            return hasRelevantEntries;
        }
    } catch (error) {
        console.log('⚠️ Could not parse search results as JSON, using fallback validation');
    }
    
    // Fallback: Check if result contains at least one keyword from original query
    const keywords = this.extractKeywords(originalQuery).split(' ');
    const lowerResult = result.toLowerCase();
    
    const hasRelevantContent = keywords.some(keyword => 
        keyword.length > 2 && lowerResult.includes(keyword.toLowerCase())
    );
    
    console.log(`🔍 Fallback relevance: ${hasRelevantContent ? 'Relevant' : 'Not relevant'}`);
    return hasRelevantContent;
}

private isTokenLimitError(error: any): boolean {
    return error?.status === 413 && 
           error?.error?.code === 'rate_limit_exceeded' &&
           error?.error?.message?.includes('Request too large');
}



  async disconnect(): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        await this.client.close();
        this.isConnected = false;
        this.connectionPromise = null;
        console.log('🔌 MCP Client disconnected');
      }
    } catch (error) {
      console.warn('⚠️ Error during disconnection:', error);
    }
  }
}

export const getMCPClient = (config: MCPClientConfig): ContentstackMCPClient => {
  return MCPConnectionPool.getInstance(config);
};