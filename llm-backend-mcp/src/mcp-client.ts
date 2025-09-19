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



// Add these methods to your existing MCP client
async smartSearchContent(query: string, contentType: string, providerType: string = 'google'): Promise<string> {
    const isGroq = providerType.toLowerCase().includes('groq');
    
    if (!isGroq) {
        // For non-GROQ providers, use comprehensive search
        return await this.searchContent(query, contentType, 20);
    }
    
    // GROQ: Optimized multi-step search to conserve tokens
    console.log('🔍 Using GROQ-optimized search strategy');
    
    const searchSteps = this.getSearchStrategyForGroq(query);
    
    for (const step of searchSteps) {
        try {
            console.log(`🔄 GROQ Step: "${step.query}" with limit ${step.limit}`);
            const result = await this.searchContent(step.query, contentType, step.limit);
            
            if (this.isValidSearchResult(result, query)) {
                console.log(`✅ GROQ found results in step ${step.step}`);
                return result;
            }
            
            // If we got results but they're not relevant, continue to next step
            if (!result.includes('Unable to') && !result.includes('No content')) {
                console.log(`⚠️ GROQ results not relevant, trying next step`);
            }
            
        } catch (error: any) {
            if (this.isTokenLimitError(error)) {
                console.log('⚠️ GROQ token limit hit, trying next step with fewer tokens');
                continue;
            }
            console.error('❌ Error in GROQ search step:', error);
        }
    }
    
    return "No relevant results found with token-efficient search";
}

private getSearchStrategyForGroq(query: string): Array<{query: string, limit: number, step: number}> {
    const keywords = this.extractKeywords(query);
    const mainKeyword = this.getMainKeyword(query);
    
    return [
        // Step 1: Exact match with very low limit (most token-efficient)
        { query: query, limit: 5, step: 1 },
        
        // Step 2: Keyword-based with moderate limit
        { query: keywords, limit: 8, step: 2 },
        
        // Step 3: Main keyword only with slightly higher limit
        { query: mainKeyword, limit: 10, step: 3 },
        
        // Step 4: Fallback with very specific filters if needed
        { query: mainKeyword, limit: 12, step: 4 }
    ];
}

private extractKeywords(query: string): string {
    const stopWords = new Set(['what', 'is', 'the', 'price', 'of', 'and', 'or', 'for', 'do', 'you', 'have', 'can', 'tell', 'me', 'about']);
    
    return query.split(' ')
        .filter(word => word.length > 2)
        .filter(word => !stopWords.has(word.toLowerCase()))
        .slice(0, 3) // Max 3 keywords
        .join(' ');
}

private getMainKeyword(query: string): string {
    const keywords = query.split(' ')
        .filter(word => word.length > 3)
        .filter(word => !['price', 'collection', 'product'].includes(word.toLowerCase()));
    
    return keywords[0] || query.split(' ')[0];
}

private isValidSearchResult(result: string, originalQuery: string): boolean {
    if (!result || result.includes('Unable to') || result.includes('No content')) {
        return false;
    }
    
    // Check if result contains at least one keyword from original query
    const keywords = this.extractKeywords(originalQuery).split(' ');
    const lowerResult = result.toLowerCase();
    
    return keywords.some(keyword => 
        keyword.length > 2 && lowerResult.includes(keyword.toLowerCase())
    );
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