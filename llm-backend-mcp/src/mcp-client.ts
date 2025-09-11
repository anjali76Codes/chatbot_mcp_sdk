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

interface CacheEntry {
  data: string;
  timestamp: number;
  ttl: number;
}

export class ContentstackMCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private availableTools: string[] = [];
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly SHORT_CACHE_TTL = 30 * 1000; // 30 seconds
  private config: MCPClientConfig;
  private isConnected: boolean = false;
  private pendingRequests: Map<string, Promise<string>> = new Map();

  constructor(config: MCPClientConfig = {}) {
    this.config = config;
    
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
    if (this.isConnected) {
      return;
    }

    try {
      console.log('🔗 Connecting to Contentstack MCP server...');
      await this.client.connect(this.transport);
      this.isConnected = true;
      console.log('✅ MCP Client connected successfully');
      
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

  private generateCacheKey(toolName: string, parameters: any): string {
    const sortedParams = Object.keys(parameters)
      .sort()
      .map(key => `${key}=${JSON.stringify(parameters[key])}`)
      .join('&');
    
    return `${toolName}:${sortedParams}`;
  }

  private getCacheTTL(toolName: string): number {
    // Longer TTL for static content, shorter for dynamic
    const staticTools = ['get_all_content_types', 'get_content_type'];
    const semiStaticTools = ['get_all_entries', 'get_all_assets'];
    
    if (staticTools.includes(toolName)) {
      return 30 * 60 * 1000; // 30 minutes
    }
    if (semiStaticTools.includes(toolName)) {
      return 5 * 60 * 1000; // 5 minutes
    }
    return this.DEFAULT_CACHE_TTL;
  }

  async callTool(toolName: string, parameters: any, timeoutMs: number = 10000): Promise<string> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      if (!this.availableTools.includes(toolName)) {
        throw new Error(`Tool '${toolName}' not available. Available tools: ${this.availableTools.join(', ')}`);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(toolName, parameters);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        console.log(`⚡ Cache hit for ${toolName}`);
        return cached.data;
      }

      // Check for pending identical requests
      if (this.pendingRequests.has(cacheKey)) {
        console.log(`⏳ Reusing pending request for ${toolName}`);
        return this.pendingRequests.get(cacheKey)!;
      }

      console.log(`🛠️ Calling tool: ${toolName}`, this.sanitizeLogParameters(parameters));
      
      // Create the request promise
      const requestPromise = (async () => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Tool call timeout: ${toolName}`)), timeoutMs);
          });

          const result = await Promise.race([
            this.client.callTool({
              name: toolName,
              arguments: parameters,
            }),
            timeoutPromise
          ]);

          const responseText = this.extractResponseText(result);
          
          // Cache successful responses
          if (responseText && !this.shouldSkipCache(toolName, responseText)) {
            this.cache.set(cacheKey, {
              data: responseText,
              timestamp: Date.now(),
              ttl: this.getCacheTTL(toolName)
            });
          }

          return responseText;
          
        } finally {
          // Remove from pending requests
          this.pendingRequests.delete(cacheKey);
        }
      })();

      // Store the pending request
      this.pendingRequests.set(cacheKey, requestPromise);
      
      return await requestPromise;
      
    } catch (error) {
      console.error(`❌ Error calling tool ${toolName}:`, error);
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`);
        }
        if (error.message.includes('not available')) {
          throw error;
        }
      }
      
      throw new Error(`Failed to execute tool ${toolName}: ${error}`);
    }
  }

  private sanitizeLogParameters(parameters: any): any {
    // Remove sensitive data from logs
    const sanitized = { ...parameters };
    if (sanitized.apiKey) delete sanitized.apiKey;
    if (sanitized.token) delete sanitized.token;
    if (sanitized.managementToken) delete sanitized.managementToken;
    return sanitized;
  }

  private extractResponseText(result: any): string {
    if (!result) return '';

    // Handle different response formats
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

    // Fallback to stringify
    return typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
  }

  private shouldSkipCache(toolName: string, response: string): boolean {
    // Don't cache empty or error responses
    if (!response || response.includes('error') || response.includes('No content found')) {
      return true;
    }
    
    // Don't cache very large responses
    if (response.length > 100000) { // 100KB limit
      return true;
    }
    
    return false;
  }

  async searchContent(query: string, contentType: string = 'product'): Promise<string> {
    const cacheKey = this.generateCacheKey('search', { query, contentType });
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('♻️ Using cached search results');
      return cached.data;
    }

    try {
      console.log(`🔍 Smart searching for "${query}" in "${contentType}"`);
      
      const searchTerms = this.extractSearchKeywords(query);
      
      const searchParams = {
        content_type_uid: contentType,
        environment: this.config.environment || process.env.CONTENTSTACK_ENVIRONMENT || 'production',
        query: searchTerms,
        limit: 20, // Balanced limit for performance
        skip: 0,
        locale: 'en-us'
      };

      const result = await this.callTool('get_all_entries', searchParams, 8000); // Shorter timeout for search
      
      if (result && this.hasResults(result)) {
        this.cache.set(cacheKey, { 
          data: result, 
          timestamp: Date.now(),
          ttl: 2 * 60 * 1000 // 2 minutes for search results
        });
        return result;
      }
      
      return await this.fallbackContentSearch(contentType, query);
      
    } catch (error) {
      console.error('❌ Search error:', error);
      return await this.fallbackContentSearch(contentType, query);
    }
  }

  private async fallbackContentSearch(contentType: string, query: string): Promise<string> {
    try {
      console.log('🔍 Falling back to filtered search...');
      
      const allEntriesParams = {
        content_type_uid: contentType,
        environment: this.config.environment || process.env.CONTENTSTACK_ENVIRONMENT || 'production',
        limit: 30 // Smaller limit for fallback
      };

      const allEntries = await this.callTool('get_all_entries', allEntriesParams, 5000);
      
      if (allEntries && this.hasResults(allEntries)) {
        const filtered = this.filterResultsByQuery(allEntries, query);
        return filtered || 'No content found matching your query.';
      }

      return 'No content found for this query.';
      
    } catch (error) {
      console.error('❌ Error in fallback search:', error);
      return 'Unable to search content at this time.';
    }
  }

  private extractSearchKeywords(query: string): string {
    const stopWords = new Set(['show', 'me', 'the', 'a', 'an', 'is', 'are', 'what', 'which', 'how', 'for', 'in', 'on', 'at', 'to']);
    const words = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5); // Limit to 5 keywords
    
    return words.join(' ');
  }

  private hasResults(result: string): boolean {
    try {
      const data = JSON.parse(result);
      return data.entries && Array.isArray(data.entries) && data.entries.length > 0;
    } catch {
      return false;
    }
  }

  private filterResultsByQuery(content: string, query: string): string {
    try {
      const contentData = JSON.parse(content);
      const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      
      if (contentData.entries && Array.isArray(contentData.entries)) {
        const filteredEntries = contentData.entries.filter((entry: any) => {
          const entryText = JSON.stringify(entry).toLowerCase();
          return queryTerms.some(term => entryText.includes(term));
        });

        if (filteredEntries.length === 0) {
          return '';
        }

        return JSON.stringify({ entries: filteredEntries }, null, 2);
      }
      
      return content;
      
    } catch (error) {
      return content;
    }
  }

  async getContentTypes(): Promise<string> {
    return this.callTool('get_all_content_types', {}, 5000);
  }

  async getEntryByUid(uid: string, contentType: string): Promise<string> {
    const params = {
      content_type_uid: contentType,
      uid: uid,
      environment: this.config.environment || process.env.CONTENTSTACK_ENVIRONMENT || 'production'
    };
    return this.callTool('get_single_entry', params);
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        await this.client.close();
        this.isConnected = false;
        console.log('🔌 MCP Client disconnected');
      }
    } catch (error) {
      console.warn('⚠️ Error during disconnection:', error);
    }
  }

  clearCache(pattern?: string): void {
    if (pattern) {
      // Clear specific cache entries
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
      console.log(`🗑️ Cleared cache entries matching: ${pattern}`);
    } else {
      // Clear all cache
      this.cache.clear();
      this.pendingRequests.clear();
      console.log('🗑️ All cache cleared');
    }
  }

  getCacheStats(): { size: number; hitRate: number } {
    // Simple cache stats implementation
    return {
      size: this.cache.size,
      hitRate: 0 // You'd need to implement hit tracking
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.callTool('get_all_content_types', {}, 3000);
      return true;
    } catch (error) {
      console.error('❌ MCP Health check failed:', error);
      return false;
    }
  }
}