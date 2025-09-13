// src/components/ProductCard.tsx
import type { Product } from '../types/product';

interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  // Add fallback for missing image - KEEPING ORIGINAL LOGIC
  const imageUrl = product.image?.url || 'https://images.pexels.com/photos/3266700/pexels-photo-3266700.jpeg';
  const hasImage = !!product.image?.url;

  return (
    <div className="group bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-amber-200">
      <div className="relative overflow-hidden">
        <img 
          src={imageUrl}
          alt={product.title}
          className="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            // Fallback if image fails to load - KEEPING ORIGINAL LOGIC
            e.currentTarget.src = 'https://images.pexels.com/photos/3266700/pexels-photo-3266700.jpeg';
          }}
        />
        <div className="absolute top-4 right-4">
          <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-md uppercase tracking-wide">
            {product.category}
          </span>
        </div>
        {!hasImage && (
          <div className="absolute inset-0 bg-amber-50 flex items-center justify-center">
            <span className="text-amber-600 text-sm">No image available</span>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-amber-700 transition-colors">
          {product.title}
        </h3>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
          {product.description}
        </p>
        
        <div className="flex items-center justify-between mb-4">
          <span className="text-2xl font-bold text-amber-700">
            ₹{product.price}
          </span>
          <span className="text-xs text-amber-800 bg-amber-100 px-3 py-1 rounded-full font-medium uppercase">
            {product.material}
          </span>
        </div>

        {product.gemstone && product.gemstone !== 'None' && (
          <div className="flex items-center mb-4 p-2 bg-amber-50 rounded-lg">
            <div className="w-3 h-3 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full mr-2"></div>
            <span className="text-sm text-amber-800 font-medium">{product.gemstone}</span>
          </div>
        )}

        <button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3 rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-lg flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View Details
        </button>

      
      
      </div>
    </div>
  );
};