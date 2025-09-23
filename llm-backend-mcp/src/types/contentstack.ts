export interface ContentstackEntry {
  uid: string;
  title: string;
  url?: string;
  description?: string;
  content?: string;
  rich_text?: string;
  created_at: string;
  updated_at: string;
  // Add other fields as needed
}

export interface ContentstackResponse {
  entries: ContentstackEntry[];
  count?: number;
}

export interface SearchCacheItem {
  data: string;
  timestamp: number;
}

export interface ChatAgentConfig {
  contentstack?: {
    apiKey?: string;
    managementToken?: string;
    environment?: string;
    region?: string;
  };
  
  llm?: {
    provider: 'google' | 'openai' | 'anthropic' | 'groq';
    apiKey?: string;
    model?: string;
    temperature?: number;
    baseURL?: string;
  };

  persistence?: {
    sessionId?: string;
    sessionsDir?: string;
    ttl?: number; // Time to live in milliseconds
  };
}

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'groq';