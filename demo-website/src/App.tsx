// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage'
import { FAQsPage } from './pages/FAQsPage'
import { PoliciesPage } from './pages/PoliciesPage'
import { ShopPage } from './pages/ShopPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { ChatWindow } from 'angupta-chat-sdk';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/faqs" element={<FAQsPage />} />
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/analytics" element={<AnalyticsPage/>}/>
      </Routes>

  {/* Floating Chat Window - appears on all pages */}
      <div className="fixed bottom-6 right-6 z-50">
        <ChatWindow 
          apiBaseUrl={import.meta.env.VITE_API_BASE_URL}
          title="Jewelry Assistant"
          position="bottom-right"
        />
      </div>
     

      {/* Footer - appears on all pages */}
      <footer className="bg-[#FDEBD0] text-black py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2024 Glimmer Jewelry. All rights reserved.</p>
          <p className="text-gray-900 mt-2">Crafted with love and precision</p>
        </div>
      </footer>
    </div>
  )
}

export default App
