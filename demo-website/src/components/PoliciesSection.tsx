// src/components/PoliciesSection.tsx
import { useState, useEffect } from 'react';
import type { Policy } from '../types/policy';
import { policyService } from '../services/policyService';

export const PoliciesSection = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await policyService.getAllPolicies();
      
      if (Array.isArray(data)) {
        setPolicies(data);
        console.log(`✅ Loaded ${data.length} policies from Contentstack`);
      } else {
        console.error('Expected array but got:', data);
        setError('Invalid data format received from Contentstack');
        setPolicies([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load policies';
      setError(errorMessage);
      console.error('Error loading policies:', err);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to extract text from JSON content
  const extractTextFromContent = (content: any): string => {
    if (typeof content === 'string') {
      return content;
    }
    
    if (typeof content === 'object' && content !== null) {
      // Try to extract text from common Contentstack JSON structures
      if (Array.isArray(content)) {
        return content.map(item => extractTextFromContent(item)).join(' ');
      }
      
      if (content.text) {
        return content.text;
      }
      
      if (content.children) {
        return extractTextFromContent(content.children);
      }
      
      // Fallback: stringify for debugging
      return JSON.stringify(content);
    }
    
    return String(content);
  };

  const categories = ['all', ...new Set(policies.map(policy => policy.policy_type))];
  const filteredPolicies = selectedCategory === 'all' 
    ? policies 
    : policies.filter(policy => policy.policy_type === selectedCategory);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-20 w-20 border-6 border-amber-500 border-t-transparent"></div>
        <span className="ml-6 text-xl font-bold text-amber-900">Loading Policies...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 bg-amber-100 rounded-3xl mx-4 border-4 border-amber-300">
        <div className="text-amber-700 text-5xl mb-6">⚠️</div>
        <h3 className="text-3xl font-bold text-amber-900 mb-4">Failed to Load Policies</h3>
        <p className="text-amber-800 text-lg mb-8 font-medium">{error}</p>
        <button 
          onClick={loadPolicies}
          className="bg-amber-600 text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-amber-700 transition-all duration-300 transform hover:scale-105 shadow-2xl border-2 border-amber-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="text-center py-20 bg-amber-100 rounded-3xl mx-4 border-4 border-amber-300">
        <div className="text-amber-500 text-7xl mb-8">📄</div>
        <h3 className="text-3xl font-bold text-amber-900 mb-4">No Policies Available</h3>
        <p className="text-amber-700 text-lg font-medium">Our policies information will be available soon.</p>
      </div>
    );
  }

  return (
    <section id="policies" className="py-20 bg-amber-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-amber-900 mb-6">
            SHIPPING & POLICIES
          </h2>
          <p className="text-amber-700 text-xl font-semibold">
            Transparent information about our shipping, returns, and customer policies
          </p>
        </div>

        {/* Category Filter - BIGGER and BOLDER */}
        <div className="flex justify-center mb-12 flex-wrap gap-4">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-110 border-4 ${
                selectedCategory === category
                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xl'
                  : 'bg-white text-amber-800 border-amber-400 hover:bg-amber-100 hover:border-amber-500 shadow-xl'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1).toUpperCase()}
            </button>
          ))}
        </div>
        
        <div className="space-y-8">
          {filteredPolicies.map((policy) => (
            <div 
              key={policy.uid} 
              className="bg-white rounded-3xl shadow-2xl border-4 border-amber-300 transition-all duration-300 hover:border-amber-500 hover:shadow-3xl transform hover:-translate-y-1"
            >
              <div className="p-8">
                <div className="mb-6">
                  <span className="inline-block px-5 py-3 bg-amber-200 text-amber-900 rounded-full text-base font-bold mb-4 border-2 border-amber-400">
                    {policy.policy_type.toUpperCase()}
                  </span>
                  <h3 className="text-2xl font-bold text-amber-900 mb-4">
                    {policy.title}
                  </h3>
                </div>
                
                <div className="pt-6">
                  <div className="text-gray-800 text-lg leading-relaxed font-medium">
                    {extractTextFromContent(policy.details)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};