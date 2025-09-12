// src/pages/PoliciesPage.tsx
import { Header } from '../components/Header'
import { PoliciesSection } from '../components/PoliciesSection'

export const PoliciesPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <PoliciesSection />
    </div>
  )
}