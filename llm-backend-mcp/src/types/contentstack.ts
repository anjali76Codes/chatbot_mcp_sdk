// src/types/contentstack.ts

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