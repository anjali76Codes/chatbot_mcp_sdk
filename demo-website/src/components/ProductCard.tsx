// src/components/ProductCard.tsx
import type { Product } from '../types/product';

interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  // Add fallback for missing image
  const imageUrl = product.image?.url || 'https://images.pexels.com/photos/3266700/pexels-photo-3266700.jpeg';
  const hasImage = !!product.image?.url;

  return (
    <div className="group bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="relative overflow-hidden">
        <img 
          src={imageUrl}
          alt={product.title}
          className="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            // Fallback if image fails to load
            e.currentTarget.src = 'https://images.pexels.com/photos/3266700/pexels-photo-3266700.jpeg';
          }}
        />
        <div className="absolute top-4 right-4">
          <span className="bg-white text-purple-600 px-3 py-1 rounded-full text-sm font-semibold shadow-md">
            {product.category}
          </span>
        </div>
        {!hasImage && (
          <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
            <span className="text-gray-500 text-sm">No image</span>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1">
          {product.title}
        </h3>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {product.description}
        </p>
        
        <div className="flex items-center justify-between mb-4">
          <span className="text-2xl font-bold text-purple-600">
            ₹{product.price}
          </span>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {product.material}
          </span>
        </div>

        {product.gemstone && product.gemstone !== 'None' && (
          <div className="flex items-center mb-4">
            <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mr-2"></div>
            <span className="text-sm text-gray-600">{product.gemstone}</span>
          </div>
        )}

        <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-[1.02]">
          View Details
        </button>
      </div>
    </div>
  );
};