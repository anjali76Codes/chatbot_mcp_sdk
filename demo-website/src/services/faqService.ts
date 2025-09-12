// src/services/faqService.ts
import type{ FAQ } from '../types/faq';
import { getApiBaseUrl, getHeaders } from './productServices';

const ENVIRONMENT = import.meta.env.VITE_CONTENTSTACK_ENVIRONMENT || 'production';

export const faqService = {
  async getAllFAQs(): Promise<FAQ[]> {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/content_types/faqs/entries?environment=${ENVIRONMENT}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch FAQs: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.entries as FAQ[];
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      throw error;
    }
  },

  async getFAQsByCategory(category: string): Promise<FAQ[]> {
    try {
      const query = { category };
      const queryParams = new URLSearchParams();
      queryParams.append('environment', ENVIRONMENT);
      queryParams.append('query', JSON.stringify(query));

      const response = await fetch(
        `${getApiBaseUrl()}/content_types/faqs/entries?${queryParams.toString()}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch FAQs by category: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.entries as FAQ[];
    } catch (error) {
      console.error('Error fetching FAQs by category:', error);
      throw error;
    }
  }
};