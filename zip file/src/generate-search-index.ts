// src/generate-search-index.ts
import { ContentstackMCPClient } from './mcp-client.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SearchIndexItem {
  question: string;
  entryId: string;
  contentType: string;
  answer: string;
  keywords: string[];
}

 class SearchIndexGenerator {
  private mcpClient: ContentstackMCPClient;

  constructor() {
    this.mcpClient = new ContentstackMCPClient();
  }

  async generateIndex(): Promise<void> {
    try {
      await this.mcpClient.connect();
      
      // 1. Get all content types
      const contentTypes = await this.getContentTypes();
      
      // 2. For each content type, get entries and create index items
      const searchIndex: SearchIndexItem[] = [];
      
      for (const contentType of contentTypes.slice(0, 5)) { // Limit to 5 types for demo
        console.log(`📝 Indexing ${contentType}...`);
        const entries = await this.mcpClient.callTool('get_all_entries', {
          content_type_uid: contentType,
          environment: 'development',
          limit: 20
        });

        const parsedEntries = JSON.parse(entries).entries || [];
        
        for (const entry of parsedEntries) {
          const indexItems = this.createIndexItemsFromEntry(entry, contentType);
          searchIndex.push(...indexItems);
        }
      }

      // 3. Save to file
      await this.saveIndex(searchIndex);
      console.log(`✅ Search index created with ${searchIndex.length} items`);
      
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
      return ['page']; // Fallback
    }
  }

private createIndexItemsFromEntry(entry: any, contentType: string): SearchIndexItem[] {
  const items: SearchIndexItem[] = [];
  
  // 1. Index main entry content
  if (entry.title) {
    items.push({
      question: `What is ${entry.title}?`,
      entryId: entry.uid,
      contentType,
      answer: entry.description || entry.title,
      keywords: [entry.title.toLowerCase(), contentType, 'about']
    });
  }

  // 2. Index ALL text content (including rich text)
  const allText = this.extractAllTextFromEntry(entry);
  if (allText) {
    items.push({
      question: `Tell me about ${entry.title || 'this content'}`,
      entryId: entry.uid,
      contentType,
      answer: allText.substring(0, 300) + (allText.length > 300 ? '...' : ''),
      keywords: allText.toLowerCase().split(/\s+/).filter(word => word.length > 3)
    });
  }

  // 3. Index ALL assets within this entry
  const allAssets = this.extractAssetsFromEntry(entry);
  allAssets.forEach(asset => {
    items.push({
      question: `Show me ${asset.filename}`,
      entryId: entry.uid,
      contentType,
      answer: `This is ${asset.filename}, a ${asset.content_type} image added on ${new Date(asset.created_at).toLocaleDateString()}`,
      keywords: [asset.filename.toLowerCase(), 'image', 'asset', 'picture']
    });
  });

  return items;
}

private extractAllTextFromEntry(entry: any): string {
  let text = '';
  
  if (entry.title) text += entry.title + ' ';
  if (entry.description) text += entry.description + ' ';
  if (entry.rich_text) text += this.extractTextFromRichText(entry.rich_text) + ' ';
  
  // Extract text from blocks
  if (entry.blocks && Array.isArray(entry.blocks)) {
    entry.blocks.forEach((block: any) => {
      if (block.block?.title) text += block.block.title + ' ';
      if (block.block?.copy) text += this.extractTextFromRichText(block.block.copy) + ' ';
    });
  }
  
  return text.trim();
}

private extractAssetsFromEntry(entry: any): any[] {
  const assets: any[] = [];
  
  // Main image
  if (entry.image && typeof entry.image === 'object') {
    assets.push(entry.image);
  }
  
  // Images in blocks
  if (entry.blocks && Array.isArray(entry.blocks)) {
    entry.blocks.forEach((block: any) => {
      if (block.block?.image && typeof block.block.image === 'object') {
        assets.push(block.block.image);
      }
    });
  }
  
  return assets;
}

  private extractTextFromRichText(richText: string): string {
    // Simple HTML tag removal
    return richText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private async saveIndex(index: SearchIndexItem[]): Promise<void> {
    const filePath = path.join(process.cwd(), 'search-index.json');
    await fs.writeFile(filePath, JSON.stringify(index, null, 2));
    console.log(`💾 Index saved to ${filePath}`);
  }
}


export { SearchIndexGenerator };