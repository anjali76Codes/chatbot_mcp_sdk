// src/components/HeroSection.tsx
// import React from 'react';

export const HeroSection = () => {
  return (
    <section className="flex min-h-[550px] items-center justify-center bg-cover bg-center bg-no-repeat" style={{backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.5)), url("https://lh3.googleusercontent.com/aida-public/AB6AXuAETOrmtVZx63K61jBIHIBzsaJNHjgCRW4Otgjn8yEdtStIIcGOxZ0DvaODL2RVBmWw9q1WRXkVIVYY1sMiv3gd_6Tp8RC41jGrCr9ed8_i9YJ7VvdKUFXR9Emy_EluUUCM8CPPZ4nKW52acakLMBDCCqDQSwX1rbP12kks9tGZ33N75myipZ60pEYpOklhnVERR_9VF2YqAkytgShR_FYQ1CabrniSAuN1zwaqO7iBTySF5KMkb3LxzaQ94vavM-COZQ6Kn_JD4yVw")'}}>
      <div className="max-w-2xl text-center text-white px-4">
        <h2 className="text-5xl font-bold tracking-tight md:text-6xl">Timeless Elegance</h2>
        <p className="mt-4 text-lg text-gray-200">
          Discover our exquisite collection of handcrafted jewelry, designed to capture the essence of sophistication and style.
        </p>
        <button className="mt-8 rounded-md bg-[#ecab13] px-8 py-3 text-sm font-bold text-[#1b170d] transition-transform hover:scale-105">
          Explore Collection
        </button>
      </div>
    </section>
  );
};