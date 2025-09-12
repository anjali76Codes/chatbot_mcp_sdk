// src/pages/ShopPage.tsx
import { Header } from '../components/Header';
import { ProductGrid } from '../components/ProductGrid';

export const ShopPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Our Jewelry Collection</h1>
          <p className="text-gray-600 text-xl">Discover our stunning range of handcrafted jewelry pieces</p>
        </div>
        
        <ProductGrid />
      </main>
    </div>
  );
};