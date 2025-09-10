// src/mcp-client.ts
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

export class ContentstackMCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private availableTools: string[] = [];
  private searchCache: Map<string, { data: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 2 * 60 * 1000;
  private readonly QUICK_CACHE_TTL = 30 * 1000;
  private quickCache: Map<string, { data: string; timestamp: number }> = new Map();
  private config: MCPClientConfig;

  // UPDATED CONSTRUCTOR - Now accepts configuration
  constructor(config: MCPClientConfig = {}) {
    this.config = config;
    
    // Use config values or fallback to environment variables
    const apiKey = config.apiKey || process.env.CONTENTSTACK_API_KEY;
    const managementToken = config.managementToken || process.env.CONTENTSTACK_MANAGEMENT_TOKEN;
    const environment = config.environment || process.env.CONTENTSTACK_ENVIRONMENT;

    if (!apiKey || !managementToken) {
      throw new Error('Contentstack API Key or Management Token not found');
    }

    const serverCommand = 'npx';
    const serverArgs = [
      '-y',
      '@contentstack/mcp'
    ];

    const env: Record<string, string> = {
      CONTENTSTACK_API_KEY: apiKey,
      CONTENTSTACK_MANAGEMENT_TOKEN: managementToken,
      CONTENTSTACK_ENVIRONMENT: environment || 'production'
    };

    console.log('🚀 Initializing MCP client...');

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
    try {
      console.log('🔗 Connecting to Contentstack MCP server...');
      await this.client.connect(this.transport);
      console.log('✅ MCP Client connected successfully');
      
      // Discover available tools
      await this.discoverTools();
      
    } catch (error) {
      console.error('❌ Failed to connect to MCP server:', error);
      throw new Error(`MCP connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async discoverTools(): Promise<void> {
    try {
      const toolsResponse = await this.client.listTools();
      this.availableTools = toolsResponse.tools.map((tool: any) => tool.name);
      console.log('🛠️ Available MCP Tools:', this.availableTools);
    } catch (error) {
      console.error('❌ Failed to discover tools:', error);
      this.availableTools = [];
    }
  }

  async callTool(toolName: string, parameters: any): Promise<string> {
    try {
      if (!this.availableTools.includes(toolName)) {
        throw new Error(`Tool '${toolName}' not available. Available tools: ${this.availableTools.join(', ')}`);
      }

      console.log(`🛠️  Calling tool: ${toolName}`, parameters);
      
      const result = await this.client.callTool({
        name: toolName,
        arguments: parameters,
      });

      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const firstContent = result.content[0];
        return firstContent.text || JSON.stringify(firstContent, null, 2);
      }
      
      return 'No content found for this query.';
      
    } catch (error) {
      console.error(`❌ Error calling tool ${toolName}:`, error);
      throw error;
    }
  }

  async searchContent(query: string, contentType: string = 'product'): Promise<string> {
    const cacheKey = `${contentType}:${query.toLowerCase()}`;
    
    // Check cache first
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('♻️  Using cached search results');
      return cached.data;
    }

    try {
      console.log(`🔍 Smart searching for "${query}" in "${contentType}"`);
      
      // Extract meaningful keywords
      const searchTerms = this.extractSearchKeywords(query);
      
      // Build search parameters
      const searchParams = {
        content_type_uid: contentType,
        environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production',
        query: searchTerms,
        limit: 5,
        locale: 'en-us'
      };

      // Execute the search
      const result = await this.callTool('get_all_entries', searchParams);
      
      // Cache successful results
      if (result && this.hasResults(result)) {
        this.searchCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
      
      return 'No relevant content found.';
      
    } catch (error) {
      console.error('❌ Search error:', error);
      return await this.getAllEntriesAndFilter(contentType, query);
    }
  }

  private extractSearchKeywords(query: string): string {
    // Remove stop words and extract meaningful keywords
    const stopWords = ['show', 'me', 'the', 'a', 'an', 'is', 'are', 'what', 'which', 'how'];
    const words = query.toLowerCase().split(/\s+/);
    return words.filter(word => word.length > 2 && !stopWords.includes(word)).join(' ');
  }

  private hasResults(result: string): boolean {
    try {
      const data = JSON.parse(result);
      return data.entries && data.entries.length > 0;
    } catch {
      return false;
    }
  }

  private filterResultsByQuery(content: string, query: string): string {
    try {
      const contentData = JSON.parse(content);
      
      if (contentData.entries && Array.isArray(contentData.entries)) {
        const filteredEntries = contentData.entries.filter((entry: any) => {
          const searchableText = JSON.stringify(entry).toLowerCase();
          return searchableText.includes(query.toLowerCase());
        });

        if (filteredEntries.length === 0) {
          return 'No content found matching your query.';
        }

        return JSON.stringify({ entries: filteredEntries }, null, 2);
      }
      
      return content;
      
    } catch (error) {
      return content;
    }
  }

  async getAllEntriesAndFilter(contentType: string, query: string): Promise<string> {
    try {
      console.log('🔍 Falling back to getting all entries...');
      
      const allEntriesParams = {
        content_type_uid: contentType,
        environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production',
        limit: 50
      };

      const allEntries = await this.callTool('get_all_entries', allEntriesParams);
      
      if (allEntries && allEntries !== 'No content found for this query.') {
        return this.filterResultsByQuery(allEntries, query);
      }

      return 'No content found for this query.';
      
    } catch (error) {
      console.error('❌ Error in fallback search:', error);
      return 'Unable to search content at this time.';
    }
  }

  async getContentTypes(): Promise<string> {
    try {
      return await this.callTool('get_all_content_types', {});
    } catch (error) {
      console.error('❌ Error getting content types:', error);
      throw error;
    }
  }

  async getEntryByUid(uid: string, contentType: string): Promise<string> {
    try {
      const params = {
        content_type_uid: contentType,
        uid: uid,
        environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production'
      };
      return await this.callTool('get_single_entry', params);
    } catch (error) {
      console.error('❌ Error getting entry by UID:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        console.log('🔌 MCP Client disconnected');
      }
    } catch (error) {
      console.warn('⚠️ Error during disconnection:', error);
    }
  }

  // Clear cache method (optional)
  clearCache(): void {
    this.searchCache.clear();
    console.log('🗑️ Search cache cleared');
  }
}