// src/search-service.ts - OPTIMIZED VERSION
import { ContentIndexItem , ContentIndexGenerator} from './generate-content-index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SearchMatch {
  uid: string;
  title: string;
  contentType: string;
  description?: string;
  score: number;
  keywords?: string[];
}

export class SearchService {
  private index: ContentIndexItem[] = [];
  private keywordIndex: Map<string, Set<number>> = new Map();
  private titleIndex: Map<string, Set<number>> = new Map();

  async initialize(): Promise<void> {
    console.time('SearchServiceInit');
    
    try {
      const indexGenerator = new ContentIndexGenerator();
      this.index = await indexGenerator.getCachedIndex();
      this.buildIndexes();
      console.log(`🔍 Search service ready with ${this.index.length} items`);
    } catch (error) {
      console.error('❌ Search service initialization failed:', error);
      this.index = [];
    }
    
    console.timeEnd('SearchServiceInit');
  }

  private buildIndexes(): void {
    // Build keyword index for fast lookup
    this.index.forEach((item, index) => {
      if (item.keywords) {
        item.keywords.forEach(keyword => {
          if (!this.keywordIndex.has(keyword)) {
            this.keywordIndex.set(keyword, new Set());
          }
          this.keywordIndex.get(keyword)!.add(index);
        });
      }

      // Index title words
      const titleWords = item.title.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      titleWords.forEach(word => {
        if (!this.titleIndex.has(word)) {
          this.titleIndex.set(word, new Set());
        }
        this.titleIndex.get(word)!.add(index);
      });
    });
  }

  findBestMatch(query: string): SearchMatch | null {
    if (!query.trim() || this.index.length === 0) return null;

    const cleanedQuery = query.toLowerCase().trim();
    const queryWords = cleanedQuery.split(/\s+/).filter(word => word.length > 2);
    
    if (queryWords.length === 0) return null;

    // Fast exact match in titles
    for (const item of this.index) {
      if (item.title.toLowerCase().includes(cleanedQuery)) {
        return {
          ...item,
          score: 1.0
        };
      }
    }

    // Keyword matching with scoring
    const matches: Map<number, number> = new Map(); // index -> score

    queryWords.forEach(word => {
      // Check keyword index
      if (this.keywordIndex.has(word)) {
        this.keywordIndex.get(word)!.forEach(index => {
          matches.set(index, (matches.get(index) || 0) + 0.8);
        });
      }

      // Check title index
      if (this.titleIndex.has(word)) {
        this.titleIndex.get(word)!.forEach(index => {
          matches.set(index, (matches.get(index) || 0) + 1.0);
        });
      }
    });

    if (matches.size === 0) return null;

    // Find best match
    let bestIndex = -1;
    let bestScore = 0;

    for (const [index, score] of matches) {
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex !== -1 && bestScore > 0.5) {
      return {
        ...this.index[bestIndex],
        score: bestScore
      };
    }

    return null;
  }

  getAllItems(): ContentIndexItem[] {
    return [...this.index];
  }

  searchByContentType(contentType: string): ContentIndexItem[] {
    return this.index.filter(item => item.contentType === contentType);
  }

  // Fast bulk search for multiple queries
  bulkSearch(queries: string[]): Map<string, SearchMatch | null> {
    const results = new Map<string, SearchMatch | null>();
    
    queries.forEach(query => {
      results.set(query, this.findBestMatch(query));
    });
    
    return results;
  }
}