import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // 3D Parallax Effect Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20; // Max rotation 20deg
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setOffset({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] text-white overflow-hidden relative flex flex-col items-center justify-center">
      
      {/* Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#E07A5F]/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#D4AF37]/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Header / Logo Area */}
      <div className="absolute top-8 left-0 right-0 flex justify-center z-20">
        <div className="flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-300">Ethiopian Artisan Alliance</span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full h-full py-20">
        
        {/* Left Side: Typography & CTA */}
        <div className="space-y-8 text-center lg:text-left order-2 lg:order-1">
          <h1 className="text-5xl md:text-7xl font-black uppercase leading-[0.9] tracking-tighter">
            Craft Your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E07A5F] to-[#D4AF37]">
              Legacy
            </span>
          </h1>
          
          <p className="text-lg md:text-xl font-medium max-w-lg mx-auto lg:mx-0 leading-relaxed text-gray-400">
            Join a sanctuary for traditional makers. Share your process, connect with masters, and bring your handmade creations to the world.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 justify-center lg:justify-start">
            <button 
              onClick={onGetStarted}
              className="group relative px-8 py-4 bg-[#E07A5F] hover:bg-[#F08A6F] text-white rounded-full font-black text-sm uppercase tracking-widest shadow-2xl shadow-[#E07A5F]/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 overflow-hidden"
            >
              <span className="relative z-10">Enter The Studio</span>
              <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
              {/* Shine effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>
            
            <button className="px-8 py-4 rounded-full font-bold text-sm uppercase tracking-widest border border-gray-700 text-gray-300 transition-all hover:bg-white/5 hover:border-gray-500">
              View Gallery
            </button>
          </div>
        </div>

        {/* Right Side: The 3D Collage */}
        <div className="relative h-[500px] w-full perspective-1000 order-1 lg:order-2 flex items-center justify-center">
          <div 
            className="relative w-full max-w-md aspect-square rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 transition-transform duration-100 ease-out"
            style={{ 
              transform: `rotateY(${offset.x}deg) rotateX(${-offset.y}deg)`,
              transformStyle: 'preserve-3d'
            }}
          >
            {/* YOUR IMAGE HERE */}
            <img 
              src="/landing-hero.png" 
              alt="Wing Artisan Collage" 
              className="w-full h-full object-cover"
            />
            
            {/* Optional: Overlay gradient to blend edges */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          </div>

          {/* Floating Decorative Elements (Parallax Layer 2) */}
          <div 
            className="absolute -top-10 -right-10 w-24 h-24 bg-[#D4AF37]/20 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center justify-center"
            style={{ transform: `translateZ(50px) translateX(${-offset.x * 2}px) translateY(${-offset.y * 2}px)` }}
          >
            <span className="text-2xl">🧶</span>
          </div>
          <div 
            className="absolute -bottom-5 -left-5 w-20 h-20 bg-[#E07A5F]/20 backdrop-blur-xl rounded-full border border-white/10 flex items-center justify-center"
            style={{ transform: `translateZ(30px) translateX(${-offset.x * 1.5}px) translateY(${-offset.y * 1.5}px)` }}
          >
            <span className="text-2xl">🏺</span>
          </div>
        </div>
      </div>
    </div>
  );
}