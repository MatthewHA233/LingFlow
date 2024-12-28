'use client';

import { AnimatedButton } from '@/components/ui/animated-button';
import { Features } from '@/components/home/Features';
import { HowItWorks } from '@/components/home/HowItWorks';
import { MatrixBackground } from '@/components/home/MatrixBackground';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col relative">
      <MatrixBackground />
      
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center py-40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-b from-white to-purple-400 bg-clip-text text-transparent mb-4">
            洪流二语习得
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-8">
            革新性的语言学习平台，让您的语言学习如洪流般自然流畅
          </p>
          
          <AnimatedButton />
        </div>
      </section>

      {/* Features */}
      <Features />

      {/* How it Works */}
      <HowItWorks />
    </div>
  );
}