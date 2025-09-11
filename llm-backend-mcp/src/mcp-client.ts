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
  private config: MCPClientConfig;
  private isConnected: boolean = false;

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

  async callTool(toolName: string, parameters: any, timeoutMs: number = 10000): Promise<string> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      if (!this.availableTools.includes(toolName)) {
        throw new Error(`Tool '${toolName}' not available. Available tools: ${this.availableTools.join(', ')}`);
      }

      console.log(`🛠️ Calling tool: ${toolName}`, this.sanitizeLogParameters(parameters));
      
      const result = await this.client.callTool({
        name: toolName,
        arguments: parameters,
      });

      return this.extractResponseText(result);
      
    } catch (error) {
      console.error(`❌ Error calling tool ${toolName}:`, error);
      
      if (error instanceof Error) {
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

  async searchContent(query: string, contentType: string = 'product'): Promise<string> {
    try {
      console.log(`🔍 Smart searching for "${query}" in "${contentType}"`);
      
      const searchParams = {
        content_type_uid: contentType,
        environment: this.config.environment || process.env.CONTENTSTACK_ENVIRONMENT || 'production',
        query: query,
        limit: 20,
        skip: 0,
        locale: 'en-us'
      };

      return await this.callTool('get_all_entries', searchParams, 8000);
      
    } catch (error) {
      console.error('❌ Search error:', error);
      return 'Unable to search content at this time.';
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