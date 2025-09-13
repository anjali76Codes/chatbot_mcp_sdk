export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'azure' | 'groq' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  // For custom providers
  endpoint?: string;
  headers?: Record<string, string>;
  // For Azure specific
  azureDeployment?: string;
  azureApiVersion?: string;
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
      priority?: number;
    }
  };
  // Cache settings
  cacheTtl?: number;
  maxEntries?: number;
}

export interface ChatConfig {
  apiBaseUrl: string;
  contentstack?: ContentstackConfig;
  llm?: LLMConfig;
  // Additional options
  streaming?: boolean;
  timeout?: number;
  retryAttempts?: number;
  // UI/UX settings
  typingIndicator?: boolean;
  typingSpeed?: number;
  // Error handling
  showErrors?: boolean;
  fallbackMessages?: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  id?: string;
  isStreaming?: boolean;
  metadata?: Record<string, any>;
}

export interface SendMessageOptions {
  conversationId?: string;
  resetConversation?: boolean;
  metadata?: Record<string, any>;
  stream?: boolean;
  onChunk?: (chunk: StreamingChunk) => void;
  // Content filtering
  contentTypes?: string[];
  // Response formatting
  format?: 'text' | 'markdown' | 'html';
  // Language settings
  language?: string;
}

export interface StreamMessageOptions extends Omit<SendMessageOptions, 'stream' | 'onChunk'> {
  onChunk: (chunk: StreamingChunk) => void;
}

export interface SendMessageResponse {
  response: string;
  conversationId?: string;
  metadata?: Record<string, any>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency?: number;
}

export interface StreamingChunk {
  content: string;
  conversationId?: string;
  done: boolean;
  error?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  title?: string;
  metadata?: Record<string, any>;
}

export interface ChatAgentState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
  isInitialized: boolean;
  hasMessages: boolean;
  canCancel: boolean;
}

export interface ChatAgentActions {
  sendMessage: (message: string, options?: SendMessageOptions) => Promise<SendMessageResponse>;
  sendMessageStream: (message: string, options: StreamMessageOptions) => Promise<void>;
  clearMessages: () => void;
  updateConfig: (newConfig: Partial<ChatConfig>) => void;
  cancelRequest: () => void;
  loadConversation: (conversationId: string) => Promise<void>;
  saveConversation: () => Promise<string>;
}

export interface ChatAgentHook extends ChatAgentState, ChatAgentActions {}

// Error types
export interface ChatError {
  code: string;
  message: string;
  details?: any;
  retryable?: boolean;
}

export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
  CONTENTSTACK_ERROR: 'CONTENTSTACK_ERROR',
  LLM_ERROR: 'LLM_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

// Event types for real-time updates
export interface ChatEvent {
  type: 'message' | 'typing' | 'error' | 'conversation_update';
  data: any;
  timestamp: Date;
}

export interface MessageEvent extends ChatEvent {
  type: 'message';
  data: ChatMessage;
}

export interface TypingEvent extends ChatEvent {
  type: 'typing';
  data: {
    isTyping: boolean;
    userId?: string;
  };
}

export interface ErrorEvent extends ChatEvent {
  type: 'error';
  data: ChatError;
}

export interface ConversationUpdateEvent extends ChatEvent {
  type: 'conversation_update';
  data: {
    conversationId: string;
    action: 'created' | 'updated' | 'deleted';
  };
}

// Configuration validation types
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Contentstack specific types
export interface ContentstackEntry {
  uid: string;
  title: string;
  url: string;
  locale: string;
  content_type: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export interface ContentstackResponse {
  entries: ContentstackEntry[];
  count: number;
  content_type: string;
}

// LLM response types
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  model?: string;
}

// API response types
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface ChatApiResponse extends SendMessageResponse {
  status: 'success' | 'error';
  error?: ChatError;
}

// Hook configuration
export interface UseChatAgentOptions {
  initialMessages?: ChatMessage[];
  initialConversationId?: string;
  autoConnect?: boolean;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: ChatError) => void;
  onConversationUpdate?: (conversationId: string) => void;
}

// Cache types
export interface CacheItem {
  key: string;
  data: any;
  timestamp: number;
  expires: number;
  tags?: string[];
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'lfu';
}