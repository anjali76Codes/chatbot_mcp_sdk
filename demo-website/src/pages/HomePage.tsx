// src/pages/HomePage.tsx
import { Header } from '../components/Header'
import { HeroSection } from '../components/HeroSection'
import { ProductGrid } from '../components/ProductGrid'
// import { FAQsSection } from '../components/FAQsSection'
// import { PoliciesSection } from '../components/PoliciesSection'

export const HomePage = () => {
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
        {/* <FAQsSection />
        <PoliciesSection /> */}
      </main>
    </div>
  )
}