import type { Product } from '../types/product';

const API_BASE_URL = 'http://localhost:3000';

export const productService = {
  async getAllProducts(): Promise<Product[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('🔍 RAW API RESPONSE:', data);
      console.log('🔍 Response type:', typeof data);
      console.log('🔍 Is array?', Array.isArray(data));
      
      // Handle different response structures
      if (Array.isArray(data)) {
        console.log('✅ Returning direct array');
        return data;
      } else if (data.products && Array.isArray(data.products)) {
        console.log('✅ Returning data.products');
        return data.products;
      } else if (data.data && Array.isArray(data.data)) {
        console.log('✅ Returning data.data');
        return data.data;
      } else if (data.data?.products && Array.isArray(data.data.products)) {
        console.log('✅ Returning data.data.products');
        return data.data.products;
      } else if (data.items && Array.isArray(data.items)) {
        console.log('✅ Returning data.items');
        return data.items;
      } else if (data.entries && Array.isArray(data.entries)) {
        console.log('✅ Returning data.entries');
        return data.entries;
      } else if (data.content && Array.isArray(data.content)) {
        console.log('✅ Returning data.content');
        return data.content;
      } else {
        // Log the actual structure to help debug
        console.error('❌ Unexpected API structure. Keys:', Object.keys(data));
        console.error('❌ Full response:', JSON.stringify(data, null, 2));
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  async getProductById(id: string): Promise<Product> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch product');
      }
      
      const data = await response.json();
      
      // Handle nested product data if needed
      if (data.product) {
        return data.product;
      } else if (data.data) {
        return data.data;
      } else if (data.entry) {
        return data.entry;
      }
      return data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }
};