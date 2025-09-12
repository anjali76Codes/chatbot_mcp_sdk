// src/components/ProductGrid.tsx
import { useState, useEffect } from 'react';
import type { Product } from '../types/product';
import { productService } from '../services/productServices';
import { ProductCard } from './ProductCard';

export const ProductGrid = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await productService.getAllProducts();
      
      if (Array.isArray(data)) {
        setProducts(data);
        console.log(`✅ Loaded ${data.length} products from Contentstack`);
      } else {
        console.error('Expected array but got:', data);
        setError('Invalid data format received from Contentstack');
        setProducts([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load products';
      setError(errorMessage);
      console.error('Error loading products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-gray-600">Loading beautiful jewelry...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-red-500 text-lg mb-4">✨</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Oops! Something went wrong</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          onClick={loadProducts}
          className="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-400 text-4xl mb-4">💎</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No products found</h3>
        <p className="text-gray-600">Check back later for our new collection.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {products.map(product => (
        <ProductCard key={product.uid} product={product} />
      ))}
    </div>
  );
};