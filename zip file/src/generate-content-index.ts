// src/generate-content-index.ts
import { ContentstackMCPClient } from './mcp-client.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ContentIndexItem {
  uid: string;
  title: string;
  contentType: string;
  description?: string;
  keywords?: string[];
  lastModified?: string;
}

export class ContentIndexGenerator {
  private mcpClient: ContentstackMCPClient;
  private cache: Map<string, ContentIndexItem[]> = new Map();

  constructor() {
    this.mcpClient = new ContentstackMCPClient();
  }

  async generateIndex(): Promise<void> {
    try {
      console.time('IndexGeneration');
      await this.mcpClient.connect();
      
      // 1. Get content types
      const contentTypes = await this.getContentTypes();
      await this.ensureCacheDirectory();
      
      // 2. Process content types in parallel with limited concurrency
      const batchSize = 3;
      const contentIndex: ContentIndexItem[] = [];
      
      for (let i = 0; i < contentTypes.length; i += batchSize) {
        const batch = contentTypes.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(contentType => this.processContentType(contentType))
        );
        
        batchResults.forEach(items => contentIndex.push(...items));
        console.log(`✅ Processed batch ${Math.ceil(i/batchSize) + 1}/${Math.ceil(contentTypes.length/batchSize)}`);
      }

      // 3. Save index with compression
      await this.saveOptimizedIndex(contentIndex);
      this.cache.set('main', contentIndex);
      
      console.timeEnd('IndexGeneration');
      console.log(`🚀 Content index created with ${contentIndex.length} items`);
      
    } catch (error) {
      console.error('❌ Error generating index:', error);
    } finally {
      await this.mcpClient.disconnect();
    }
  }

  private async getContentTypes(): Promise<string[]> {
    try {
      const response = await this.mcpClient.callTool('get_all_content_types', {});
      const data = JSON.parse(response);
      return data.content_types?.map((ct: any) => ct.uid) || [];
    } catch (error) {
      console.error('Error getting content types:', error);
      return ['page']; // Fallback to common content types
    }
  }

  private async processContentType(contentType: string): Promise<ContentIndexItem[]> {
    try {
      console.log(`⚡ Indexing ${contentType}...`);
      
      const entries = await this.mcpClient.callTool('get_all_entries', {
        content_type_uid: contentType,
        environment: 'development',
        limit: 100,
        only: ['title', 'uid', 'description', 'summary', 'name', 'updated_at']
      });

      const parsedEntries = JSON.parse(entries).entries || [];
      
      return parsedEntries.map((entry: any) => ({
        uid: entry.uid,
        title: entry.title || 'No Title',
        contentType: contentType,
        description: entry.description || entry.summary || entry.name,
        lastModified: entry.updated_at,
        keywords: this.extractKeywords(entry)
      }));
      
    } catch (error) {
      console.error(`⚠️ Failed to index ${contentType}:`, error);
      return [];
    }
  }

  private extractKeywords(entry: any): string[] {
    const keywords: string[] = [];
    const text = `${entry.title} ${entry.description} ${entry.summary} ${entry.name}`.toLowerCase();
    
    const words = text.split(/\s+/).filter(word => word.length > 3);
    keywords.push(...words);
    
    return [...new Set(keywords)];
  }

  private async ensureCacheDirectory(): Promise<void> {
    const cacheDir = path.join(process.cwd(), 'cache');
    try {
      await fs.mkdir(cacheDir, { recursive: true });
    } catch (error) {
      // Directory likely exists
    }
  }

  private async saveOptimizedIndex(index: ContentIndexItem[]): Promise<void> {
    const filePath = path.join(process.cwd(), 'cache', 'content_index.json');
    
    const compressedData = JSON.stringify(index);
    await fs.writeFile(filePath, compressedData);
    
    console.log(`💾 Optimized index saved to ${filePath} (${compressedData.length} bytes)`);
  }

  async getCachedIndex(): Promise<ContentIndexItem[]> {
    if (this.cache.has('main')) {
      return this.cache.get('main')!;
    }

    try {
      const filePath = path.join(process.cwd(), 'cache', 'content_index.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const index = JSON.parse(data);
      this.cache.set('main', index);
      return index;
    } catch (error) {
      console.warn('⚠️ No cached index found, generating new one...');
      await this.generateIndex();
      return this.cache.get('main') || [];
    }
  }
}

// Export alias for backward compatibility
export { ContentIndexGenerator as SearchIndexGenerator };