import { ChatWindow } from './ChatWindow';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { ProductGrid } from './components/ProductGrid';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <Header />
      <HeroSection />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Collection</h2>
          <p className="text-gray-600 text-lg">Browse our stunning range of handcrafted jewelry</p>
        </div>
        
        <ProductGrid />
      </main>

      {/* Floating Chat Window */}
      <div className="fixed bottom-6 right-6 z-50">
        <ChatWindow />
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2024 Glimmer Jewelry. All rights reserved.</p>
          <p className="text-gray-400 mt-2">Crafted with love and precision</p>
        </div>
      </footer>
    </div>
  );
}

export default App;