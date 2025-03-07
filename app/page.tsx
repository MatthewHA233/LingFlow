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
            洪流二语习得 - 革新性语言学习平台
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-8">
            借助智能化“词锚点域”与大语言模型，构建属于你自己习得语料的宇宙！
          </p>
          

          <AnimatedButton />
        </div>
      </section>

      {/* Features */}
      <Features />

      {/* How it Works */}
      <HowItWorks />

      {/* 添加页脚 */}
      <footer className="w-full py-6 mt-auto border-t border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center space-y-2 text-sm text-gray-400">
            <div>© 2025 洪流二语习得. 保留所有权利.</div>
            <div className="flex items-center space-x-1">
              <a 
                href="https://beian.miit.gov.cn/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-gray-300 transition-colors"
              >
                鄂ICP备2024085025号
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}