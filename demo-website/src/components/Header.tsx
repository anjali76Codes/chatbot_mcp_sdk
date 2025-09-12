// src/components/Header.tsx
import { Link, useLocation } from 'react-router-dom'

export const Header = () => {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#f3f0e7] bg-[#fcfbf8] px-10 py-4">
      <Link to="/" className="flex items-center gap-3 text-[#1b170d]">
        <svg className="h-6 w-6 text-[#ecab13]" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path d="M36.7273 44C33.9891 44 31.6043 39.8386 30.3636 33.69C29.123 39.8386 26.7382 44 24 44C21.2618 44 18.877 39.8386 17.6364 33.69C16.3957 39.8386 14.0109 44 11.2727 44C7.25611 44 4 35.0457 4 24C4 12.9543 7.25611 4 11.2727 4C14.0109 4 16.3957 8.16144 17.6364 14.31C18.877 8.16144 21.2618 4 24 4C26.7382 4 29.123 8.16144 30.3636 14.31C31.6043 8.16144 33.9891 4 36.7273 4C40.7439 4 44 12.9543 44 24C44 35.0457 40.7439 44 36.7273 44Z" fill="currentColor"></path>
        </svg>
        <h2 className="text-xl font-bold tracking-tighter text-[#1b170d]">Glimmer Jewels</h2>
      </Link>
      
      <nav className="flex items-center gap-8">
        <Link 
          to="/" 
          className={`text-sm font-medium transition-colors ${
            isActive('/') ? 'text-[#ecab13]' : 'text-[#000000] hover:text-[#ecab13]'
          }`}
        >
          Home
        </Link>
        <Link 
          to="/shop" 
          className={`text-sm font-medium transition-colors ${
            isActive('/shop') ? 'text-[#ecab13]' : 'text-[#000000] hover:text-[#ecab13]'
          }`}
        >
          Shop
        </Link>
        <Link 
          to="/faqs" 
          className={`text-sm font-medium transition-colors ${
            isActive('/faqs') ? 'text-[#ecab13]' : 'text-[#000000] hover:text-[#ecab13]'
          }`}
        >
          FAQs
        </Link>
        <Link 
          to="/policies" 
          className={`text-sm font-medium transition-colors ${
            isActive('/policies') ? 'text-[#ecab13]' : 'text-[#000000] hover:text-[#ecab13]'
          }`}
        >
          Policies
        </Link>
        <Link 
          to="/" 
          className={`text-sm font-medium transition-colors ${
            isActive('/about') ? 'text-[#ecab13]' : 'text-[#000000] hover:text-[#ecab13]'
          }`}
        >
          About
        </Link>
        <Link 
          to="/" 
          className={`text-sm font-medium transition-colors ${
            isActive('/contact') ? 'text-[#ecab13]' : 'text-[#000000] hover:text-[#ecab13]'
          }`}
        >
          Contact
        </Link>
      </nav>
      
      <div className="flex items-center gap-4">
        <button className="text-[#1b170d] hover:text-[#ecab13] transition-colors">
          <svg fill="currentColor" height="20px" viewBox="0 0 256 256" width="20px" xmlns="http://www.w3.org/2000/svg">
            <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>
          </svg>
        </button>
        <button className="text-[#1b170d] hover:text-[#ecab13] transition-colors">
          <svg fill="currentColor" height="20px" viewBox="0 0 256 256" width="20px" xmlns="http://www.w3.org/2000/svg">
            <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200ZM176,88a48,48,0,0,1-96,0,8,8,0,0,1,16,0,32,32,0,0,0,64,0,8,8,0,0,1,16,0Z"></path>
          </svg>
        </button>
      </div>
    </header>
  )
}