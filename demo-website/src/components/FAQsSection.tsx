// src/components/FAQsSection.tsx
import { useState, useEffect } from 'react';
import type { FAQ } from '../types/faq';
import { faqService } from '../services/faqService';

export const FAQsSection = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await faqService.getAllFAQs();
      
      if (Array.isArray(data)) {
        setFaqs(data);
        console.log(`✅ Loaded ${data.length} FAQs from Contentstack`);
      } else {
        console.error('Expected array but got:', data);
        setError('Invalid data format received from Contentstack');
        setFaqs([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load FAQs';
      setError(errorMessage);
      console.error('Error loading FAQs:', err);
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleQuestion = (uid: string) => {
    setOpenQuestion(openQuestion === uid ? null : uid);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-400 border-t-transparent"></div>
        <span className="ml-4 text-lg text-amber-800 font-medium">Loading FAQs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 bg-red-50 rounded-2xl mx-4">
        <div className="text-red-500 text-4xl mb-4">❓</div>
        <h3 className="text-2xl font-bold text-red-800 mb-3">Failed to load FAQs</h3>
        <p className="text-red-600 mb-6 text-lg">{error}</p>
        <button 
          onClick={loadFAQs}
          className="bg-red-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-red-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (faqs.length === 0) {
    return (
      <div className="text-center py-20 bg-amber-50 rounded-2xl mx-4">
        <div className="text-amber-400 text-6xl mb-6">💎</div>
        <h3 className="text-2xl font-bold text-amber-800 mb-3">No FAQs Available</h3>
        <p className="text-amber-600 text-lg">We're preparing answers to your questions. Check back soon!</p>
      </div>
    );
  }

  return (
    <section id="faqs" className="py-20 bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-bold text-amber-900 mb-6 drop-shadow-lg">
            Frequently Asked Questions
          </h2>
          <p className="text-amber-700 text-xl max-w-3xl mx-auto leading-relaxed">
            Everything you need to know about our exquisite jewelry collection and services
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto space-y-6">
          {faqs.map((faq, index) => (
            <div 
              key={faq.uid} 
              className={`bg-white rounded-2xl shadow-2xl border-4 border-amber-200 transition-all duration-300 hover:border-amber-400 hover:shadow-3xl transform hover:-translate-y-1 ${
                openQuestion === faq.uid ? 'border-amber-500' : ''
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <button
                onClick={() => toggleQuestion(faq.uid)}
                className="w-full p-8 text-left flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-amber-300 rounded-2xl"
              >
                <h3 className="text-2xl font-bold text-amber-900 pr-4">
                  {faq.question}
                </h3>
                <div className="flex-shrink-0 ml-4">
                  <div className={`w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center transition-transform duration-300 ${
                    openQuestion === faq.uid ? 'rotate-180 bg-amber-200' : ''
                  }`}>
                    <svg 
                      className="w-5 h-5 text-amber-600" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>
              
              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                openQuestion === faq.uid ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="px-8 pb-8">
                  <div className="border-t-2 border-amber-100 pt-6">
                    <div className="text-gray-700 text-lg leading-relaxed">
                      {extractTextFromContent(faq.answer)}
                    </div>
                  </div>
                  {faq.category && (
                    <div className="mt-6">
                      <span className="inline-block px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-600 text-white rounded-full text-sm font-semibold shadow-lg">
                        {faq.category}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};