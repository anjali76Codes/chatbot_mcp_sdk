// src/components/HeroSection.tsx
// Make sure to import the video file
import landingVideo from '../assets/landing.mp4';
// import React from 'react';

export const HeroSection = () => {
  return (
    <section className="relative flex min-h-[550px] items-center justify-center">
      {/* Background Video */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src={landingVideo} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Overlay to darken the video */}
      <div className="absolute inset-0 bg-black opacity-30"></div>

      {/* Content */}
      <div className="relative z-10 max-w-2xl text-center text-white px-4">
        <h2 className="text-5xl font-bold tracking-tight md:text-6xl">Timeless Elegance</h2>
        {/* Added the font-serif class */}
        <p className="mt-4 text-lg text-gray-100 font-Cinzel">
          Discover our exquisite collection of handcrafted jewelry, designed to capture the essence of sophistication and style.
        </p>
        <button className="mt-8 rounded-md bg-[#ecab13] px-8 py-3 text-sm font-bold text-[#1b170d] transition-transform hover:scale-105">
          Explore Collection
        </button>
      </div>
    </section>
  );
};