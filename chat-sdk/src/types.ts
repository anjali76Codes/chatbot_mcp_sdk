// In your types.ts, consider adding these enhancements:
export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'azure' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // For custom providers
  endpoint?: string;
  headers?: Record<string, string>;
}

export interface ContentstackConfig {
  apiKey: string;
  deliveryToken: string;
  environment: string;
  region?: string;
  // Optional content type configurations
  contentTypes?: {
    [key: string]: {
      fields: string[];
      searchable?: boolean;
    }
  };
}

export interface ChatConfig {
  apiBaseUrl: string;
  contentstack: ContentstackConfig;
  llm: LLMConfig;
  // Additional options
  streaming?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface SendMessageOptions {
  conversationId?: string;
  resetConversation?: boolean;
  metadata?: Record<string, any>;
  stream?: boolean; // Add this property
  onChunk?: (chunk: string) => void; // Add this property
}

export interface SendMessageResponse {
  response: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

// Add these additional types for streaming
export interface StreamingChunk {
  content: string;
  conversationId?: string;
  done?: boolean;
}