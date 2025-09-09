// src/search-service.ts (with natural library)
import * as fs from 'fs/promises';
import * as path from 'path';
import natural from 'natural';

interface SearchIndexItem {
  question: string;
  entryId: string;
  contentType: string;
  answer: string;
  keywords: string[];
}

export class SearchService {
  private index: SearchIndexItem[] = [];
  private tokenizer: any;

  constructor() {
    // Initialize the tokenizer correctly
    this.tokenizer = new natural.WordTokenizer();
  }

  async initialize(): Promise<void> {
    try {
      const filePath = path.join(process.cwd(), 'search-index.json');
      const data = await fs.readFile(filePath, 'utf-8');
      this.index = JSON.parse(data);
      console.log(`✅ Search service loaded ${this.index.length} index items`);
    } catch (error) {
      console.error('❌ Error loading search index:', error);
      this.index = [];
    }
  }

  findBestMatch(query: string): SearchIndexItem | null {
    const queryTokens = this.tokenizer.tokenize(query.toLowerCase()) || [];
    
    let bestMatch: SearchIndexItem | null = null;
    let bestScore = 0;

    for (const item of this.index) {
      const score = this.calculateMatchScore(queryTokens, item, query);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    return bestScore > 0.3 ? bestMatch : null;
  }

  private calculateMatchScore(queryTokens: string[], item: SearchIndexItem, query: string): number {
    let score = 0;
    
    // Check against question
    const questionTokens = this.tokenizer.tokenize(item.question.toLowerCase()) || [];
    score += this.getTokenOverlapScore(queryTokens, questionTokens) * 0.4;
    
    // Check against keywords
    score += this.getTokenOverlapScore(queryTokens, item.keywords) * 0.4;
    
    // Check for exact matches
    if (item.question.toLowerCase().includes(query.toLowerCase())) {
      score += 0.2;
    }

    return score;
  }

  private getTokenOverlapScore(tokens1: string[], tokens2: string[]): number {
    const intersection = tokens1.filter(token => tokens2.includes(token));
    return intersection.length / Math.max(tokens1.length, 1);
  }

  getAllIndexedQuestions(): string[] {
    return this.index.map(item => item.question);
  }
}