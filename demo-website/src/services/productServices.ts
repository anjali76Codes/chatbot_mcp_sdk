import { config } from '../../next.config.ts';


import type { Product } from '../types/product';



const API_KEY = config.contentstackApiKey || '';
const DELIVERY_TOKEN = config.contentstackDeliveryToken || '';
const ENVIRONMENT = config.contentstackEnvironment || '';
const REGION = config.contentstackRegion || 'us';

if (typeof window !== 'undefined' && (!API_KEY || !DELIVERY_TOKEN || !ENVIRONMENT)) {
  console.warn('Contentstack environment variables are not properly configured');
}


// Rest of your code remains the same...
const getApiBaseUrl = () => {
  const regionPrefix = REGION === 'eu' ? 'eu-api' : 'cdn';
  return `https://${regionPrefix}.contentstack.com/v3`;
};

const getHeaders = () => ({
  api_key: API_KEY,
  access_token: DELIVERY_TOKEN,
  'Content-Type': 'application/json',
});
export const productService = {
  async getAllProducts(): Promise<Product[]> {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/content_types/product/entries?environment=${ENVIRONMENT}&limit=100`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.entries as Product[];
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  async getProductById(uid: string): Promise<Product> {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/content_types/product/entries/${uid}?environment=${ENVIRONMENT}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.entry as Product;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw error;
    }
  },

  async searchProducts(params: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    material?: string;
    limit?: number;
    skip?: number;
  }): Promise<Product[]> {
    try {
      const query: any = {};

      if (params.category) query.category = params.category;
      if (params.minPrice !== undefined) query.price = { ...query.price, $gte: params.minPrice };
      if (params.maxPrice !== undefined) query.price = { ...query.price, $lte: params.maxPrice };
      if (params.material) query.material = params.material;

      const queryParams = new URLSearchParams();
      queryParams.append('environment', ENVIRONMENT);
      queryParams.append('limit', (params.limit || 100).toString());
      queryParams.append('skip', (params.skip || 0).toString());
      if (Object.keys(query).length > 0) {
        queryParams.append('query', JSON.stringify(query));
      }

      const response = await fetch(
        `${getApiBaseUrl()}/content_types/product/entries?${queryParams.toString()}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to search products: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.entries as Product[];
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  },
};
