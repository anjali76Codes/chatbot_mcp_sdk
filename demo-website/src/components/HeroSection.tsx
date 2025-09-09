// src/components/HeroSection.jsx

// import React from 'react';

export const HeroSection = () => {
  return (
    <section className="relative bg-gradient-to-br from-purple-900 via-purple-700 to-pink-600 text-white overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-pink-300 rounded-full animate-bounce delay-1000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 text-center">
        {/* Main heading with animation */}
        <div className="animate-fade-in-up">
          <h2 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Discover{' '}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-yellow-200 to-pink-200 bg-clip-text text-transparent">
                Timeless
              </span>
              <span className="absolute -inset-2 bg-purple-600/20 rounded-lg -rotate-2 animate-pulse"></span>
            </span>{' '}
            Elegance
          </h2>
        </div>

        {/* Subtitle with staggered animation */}
        <div className="animate-fade-in-up delay-150">
          <p className="text-xl md:text-2xl mb-10 max-w-3xl mx-auto leading-relaxed font-light">
            Handcrafted jewelry that tells your unique story. Each piece is meticulously designed to 
            capture moments of beauty and grace that last a lifetime.
          </p>
        </div>

        {/* CTA Buttons with animations */}
        <div className="animate-fade-in-up delay-300 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button className="relative group bg-white text-purple-600 px-8 py-4 rounded-full font-semibold text-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 shadow-lg">
            <span className="relative z-10">Explore Collection</span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur opacity-0 group-hover:opacity-75 transition-opacity duration-500"></div>
          </button>

          <button className="relative group border-2 border-white/30 text-white px-8 py-4 rounded-full font-semibold text-lg hover:border-white transition-all duration-500 transform hover:scale-105">
            <span className="relative z-10">Book Consultation</span>
            <div className="absolute inset-0 bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </button>
        </div>

        {/* Stats section */}
        <div className="animate-fade-in-up delay-500 grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-white/20">
          {[
            { number: '500+', label: 'Happy Customers' },
            { number: '20+', label: 'Designers' },
            { number: '100%', label: 'Satisfaction' }
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-yellow-200 mb-2">{stat.number}</div>
              <div className="text-sm md:text-base text-white/80 font-light">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating jewelry elements */}
      <div className="absolute top-20 left-10 animate-float">
        <div className="w-4 h-4 bg-diamond bg-contain"></div>
      </div>
      <div className="absolute bottom-20 right-10 animate-float delay-1000">
        <div className="w-6 h-6 bg-ring bg-contain"></div>
      </div>
    </section>
  );
};