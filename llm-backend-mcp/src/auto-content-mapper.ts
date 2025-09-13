// src/auto-content-mapper.ts
import * as fs from 'fs';
import * as path from 'path';
import { ContentstackMCPClient } from './mcp-client.js';

export interface ProductData {
  entry_uid: string;
  content_type: string;
  response_template: string;
  fields: {
    title: string;
    price: string;
    description: string;
    image: string;
    [key: string]: string;
  };
}

export interface ContentMapping {
  products: {
    [key: string]: ProductData;
  };
  search_aliases: {
    [productKey: string]: string[];
  };
  last_updated: string;
}

export class AutoContentMapper {
  private mapping: ContentMapping = {
    products: {},
    search_aliases: {},
    last_updated: new Date().toISOString()
  };
  private mcpClient: ContentstackMCPClient;
  private mappingFilePath: string;

  constructor(mcpClient: ContentstackMCPClient, mappingFilePath: string = './content-mapping-auto.json') {
    this.mcpClient = mcpClient;
    this.mappingFilePath = path.resolve(process.cwd(), mappingFilePath);
    this.loadExistingMapping();
  }

  private loadExistingMapping(): void {
    try {
      if (fs.existsSync(this.mappingFilePath)) {
        const data = fs.readFileSync(this.mappingFilePath, 'utf-8');
        this.mapping = JSON.parse(data);
        console.log('📁 Loaded existing content mapping');
      }
    } catch (error) {
      console.log('ℹ️ No existing mapping found, will create new one');
    }
  }

  private saveMapping(): void {
    try {
      fs.writeFileSync(this.mappingFilePath, JSON.stringify(this.mapping, null, 2));
      console.log('💾 Content mapping saved');
    } catch (error) {
      console.error('❌ Error saving content mapping:', error);
    }
  }

  // 🚀 AUTO-GENERATE MAPPING FROM CONTENTSTACK
  async generateMapping(): Promise<void> {
    console.log('🔄 Generating content mapping from Contentstack...');
    
    try {
      // Clear existing mapping
      this.mapping.products = {};
      this.mapping.search_aliases = {};

      // Get all content types
      let contentTypes: string[] = [];
      
      try {
        const contentTypesResponse = await this.mcpClient.callTool('get_all_content_types', {});
        const contentTypesData = JSON.parse(contentTypesResponse);
        if (contentTypesData && Array.isArray(contentTypesData.content_types)) {
          contentTypes = contentTypesData.content_types
            .map((ct: any) => ct.uid)
            .filter(Boolean);
          console.log(`📋 Found content types: ${contentTypes.join(', ')}`);
        }
      } catch (error) {
        console.error('❌ Error getting content types:', error);
        // If we can't get content types, try with common ones
        contentTypes = ['product', 'page', 'blog'];
      }

      // Get entries from each content type
      for (const contentType of contentTypes) {
        try {
          console.log(`📦 Fetching entries for content type: ${contentType}`);
          
          const entriesResponse = await this.mcpClient.callTool('get_all_entries', {
            content_type_uid: contentType,
            environment: 'production',
            limit: 20, // Reduced limit for safety
            skip: 0,
            locale: 'en-us'
          });

          const entriesData = JSON.parse(entriesResponse);
          
          if (entriesData && Array.isArray(entriesData.entries)) {
            console.log(`✅ Found ${entriesData.entries.length} entries in ${contentType}`);
            
            for (const entry of entriesData.entries) {
              try {
                const productKey = this.generateProductKey(entry);
                
                this.mapping.products[productKey] = {
                  entry_uid: entry.uid,
                  content_type: contentType,
                  response_template: "The {title} is priced at {price}.",
                  fields: {
                    title: entry.title || 'Untitled',
                    price: this.extractPrice(entry),
                    description: entry.description || entry.body || '',
                    image: this.extractImage(entry)
                  }
                };

                // Generate search aliases
                this.mapping.search_aliases[productKey] = this.generateSearchAliases(entry);
              } catch (entryError) {
                console.error(`❌ Error processing entry ${entry.uid}:`, entryError);
              }
            }
          }
        } catch (contentTypeError) {
          console.error(`❌ Error fetching entries for content type ${contentType}:`, contentTypeError);
        }
      }

      this.mapping.last_updated = new Date().toISOString();
      this.saveMapping();
      console.log(`✅ Generated mapping for ${Object.keys(this.mapping.products).length} items`);
    } catch (error) {
      console.error('❌ Error generating mapping:', error);
      // Don't create fallback data - keep it empty for plug-and-play
    }
  }

  private generateProductKey(entry: any): string {
    // Create a URL-friendly key from title or uid
    const baseKey = entry.title || entry.uid;
    return baseKey
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 30) || `item-${entry.uid}`;
  }

  private extractPrice(entry: any): string {
    // Extract price from various possible field names
    const priceFields = ['price', 'cost', 'amount', 'product_price', 'sale_price'];
    for (const field of priceFields) {
      if (entry[field] !== undefined && entry[field] !== null && entry[field] !== '') {
        return typeof entry[field] === 'number' ? `₹${entry[field]}` : entry[field];
      }
    }
    return 'Price not available';
  }

  private extractImage(entry: any): string {
    // Extract image from various possible field names
    const imageFields = ['image', 'photo', 'picture', 'thumbnail', 'main_image'];
    for (const field of imageFields) {
      if (entry[field] && typeof entry[field] === 'object' && entry[field].url) {
        return entry[field].url;
      }
      if (typeof entry[field] === 'string') {
        return entry[field];
      }
    }
    return '';
  }

  private generateSearchAliases(entry: any): string[] {
    const aliases: string[] = [];
    const title = entry.title?.toLowerCase() || '';
    
    if (title) {
      aliases.push(title);
      // Add words from title as individual aliases
      title.split(' ').forEach((word:string) => {
        if (word.length > 2) aliases.push(word);
      });
    }

    // Add category/tags if available
    if (entry.category) {
      aliases.push(entry.category.toLowerCase());
    }
    if (entry.tags && Array.isArray(entry.tags)) {
      entry.tags.forEach((tag: string) => aliases.push(tag.toLowerCase()));
    }

    return [...new Set(aliases)]; // Remove duplicates
  }

  // 🚀 ULTRA-FAST PRODUCT SEARCH
  findProduct(query: string): ProductData | null {
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery || Object.keys(this.mapping.products).length === 0) {
      return null;
    }

    // 1. Direct match check (fastest)
    if (this.mapping.products[normalizedQuery]) {
      return this.mapping.products[normalizedQuery];
    }

    // 2. Check for plural/singular forms
    const singularForm = normalizedQuery.endsWith('s') ? normalizedQuery.slice(0, -1) : normalizedQuery;
    const pluralForm = normalizedQuery + 's';
    
    if (this.mapping.products[singularForm]) {
      return this.mapping.products[singularForm];
    }
    if (this.mapping.products[pluralForm]) {
      return this.mapping.products[pluralForm];
    }

    // 3. Check search aliases
    for (const [productKey, aliases] of Object.entries(this.mapping.search_aliases)) {
      if (aliases.some(alias => 
        normalizedQuery.includes(alias) || 
        alias.includes(normalizedQuery)
      )) {
        return this.mapping.products[productKey] || null;
      }
    }

    // 4. Keyword-based search in product fields
    for (const productData of Object.values(this.mapping.products)) {
      const productTitle = productData.fields.title.toLowerCase();
      const productDesc = productData.fields.description.toLowerCase();
      
      if (normalizedQuery.includes(productTitle) ||
          productTitle.includes(normalizedQuery) ||
          productDesc.includes(normalizedQuery)) {
        return productData;
      }
    }

    return null;
  }

  // 🚀 FIND PRODUCTS BY BUDGET
  findProductsByBudget(budgetQuery: string): ProductData[] {
    if (Object.keys(this.mapping.products).length === 0) return [];

    const budgetMatch = budgetQuery.match(/(\d+[,.]?\d*)\s*(rs|inr|₹|rupees?)/i);
    let budget = budgetMatch ? parseFloat(budgetMatch[1].replace(',', '')) : 0;
    
    if (!budget) {
      // Try to extract just numbers
      const numberMatch = budgetQuery.match(/\d+[,.]?\d*/);
      budget = numberMatch ? parseFloat(numberMatch[0].replace(',', '')) : 0;
    }

    if (!budget) return [];

    const affordableProducts: ProductData[] = [];

    for (const productData of Object.values(this.mapping.products)) {
      const priceText = productData.fields.price;
      const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
      
      if (!isNaN(price) && price <= budget) {
        affordableProducts.push(productData);
      }
    }

    // Sort by price (lowest first)
    return affordableProducts.sort((a, b) => {
      const priceA = parseFloat(a.fields.price.replace(/[^\d.]/g, ''));
      const priceB = parseFloat(b.fields.price.replace(/[^\d.]/g, ''));
      return priceA - priceB;
    });
  }

  // 🚀 GET ALL PRODUCTS
  getAllProducts(): ProductData[] {
    return Object.values(this.mapping.products);
  }

  // 🚀 GENERATE RESPONSE FROM TEMPLATE
  generateResponse(productData: ProductData): string {
    const template = productData.response_template;
    return template.replace(/{(\w+)}/g, (_, key) => {
      return productData.fields[key] || '';
    });
  }

  // 🚀 CHECK IF MAPPING NEEDS REFRESH (once per hour)
  shouldRefreshMapping(): boolean {
    if (Object.keys(this.mapping.products).length === 0) return true;
    
    const lastUpdated = new Date(this.mapping.last_updated);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastUpdated < oneHourAgo;
  }

  // 🚀 CHECK IF MAPPING IS EMPTY
  isEmpty(): boolean {
    return Object.keys(this.mapping.products).length === 0;
  }


  
}