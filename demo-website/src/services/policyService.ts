// src/services/policyService.ts
import type{ Policy } from '../types/policy';
import { getApiBaseUrl, getHeaders } from './productServices';

const ENVIRONMENT = import.meta.env.VITE_CONTENTSTACK_ENVIRONMENT || 'production';

export const policyService = {
  async getAllPolicies(): Promise<Policy[]> {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/content_types/shipping_policies/entries?environment=${ENVIRONMENT}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch policies: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.entries as Policy[];
    } catch (error) {
      console.error('Error fetching policies:', error);
      throw error;
    }
  },

  async getPoliciesByType(policyType: string): Promise<Policy[]> {
    try {
      const query = { policy_type: policyType };
      const queryParams = new URLSearchParams();
      queryParams.append('environment', ENVIRONMENT);
      queryParams.append('query', JSON.stringify(query));

      const response = await fetch(
        `${getApiBaseUrl()}/content_types/shipping_policies/entries?${queryParams.toString()}`,
        { headers: getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch policies by type: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.entries as Policy[];
    } catch (error) {
      console.error('Error fetching policies by type:', error);
      throw error;
    }
  }
};