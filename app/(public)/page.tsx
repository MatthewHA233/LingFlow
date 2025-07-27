'use client';
import { useEffect, useState, useRef } from 'react';
import { AnimatedButton } from '@/components/ui/animated-button';
import { Features } from '@/components/home/Features';
import { HowItWorks } from '@/components/home/HowItWorks';
import { MatrixBackground } from '@/components/home/MatrixBackground';
import { TypewriterEffectSmooth } from '@/components/ui/typewriter-effect';
import { SequentialTypewriter } from '@/components/ui/typewriter-text';

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const featuresRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);

  // 检测设备尺寸
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 添加滚动监听
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      if (target) {
        setScrollPosition(target.scrollTop);
      }
    };
    
    // 找到滚动容器并添加事件监听
    const scrollContainer = document.querySelector('.overflow-auto') as HTMLDivElement;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // 桌面端使用打字机效果
  const desktopTitleWords = [
    {
      text: "洪流二语习得 - 革新性语言学习平台",
      className: "bg-gradient-to-b from-white to-purple-400 bg-clip-text text-transparent"
    }
  ];
  
  // 移动端使用多行文本，但仍保留打字机效果
  const mobileTitleWords = [
    {
      text: "洪流二语习得",
      className: "bg-gradient-to-r from-purple-400 via-white to-purple-400 bg-clip-text text-transparent bg-300% animate-gradient-x"
    }
  ];
  
  const mobileSubtitleWords = [
    {
      text: "革新性语言学习平台",
      className: "bg-gradient-to-b from-white to-purple-400 bg-clip-text text-transparent"
    }
  ];
  
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-black">
      <MatrixBackground />
      
      {/* Hero Section - 修改移动端布局使标题垂直居中 */}
      <section className={`${isMobile ? 'min-h-[80vh] flex' : 'py-40'} flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8`}>
        <div className={`${isMobile ? 'my-auto py-12' : ''} max-w-7xl mx-auto text-center`}>
          {/* 根据设备类型显示不同的标题 */}
          <div className="mb-4 px-2">
            {isMobile ? (
              // 移动端显示紧凑的两行打字机效果，增大字体并确保居中
              <div className="space-y-3 max-w-xs mx-auto text-center">
                <div className="flex justify-center">
                  <TypewriterEffectSmooth 
                    words={mobileTitleWords} 
                    className="text-5xl font-bold tracking-tight text-center"
                    cursorClassName="bg-purple-400 h-7 hidden"
                  />
                </div>
                <div className="flex justify-center py-2">
                  <TypewriterEffectSmooth 
                    words={mobileSubtitleWords} 
                    className="text-2xl font-bold tracking-tight text-center"
                    cursorClassName="bg-purple-400 h-6"
                  />
                </div>
              </div>
            ) : (
              // 桌面端显示单行打字机效果
              <TypewriterEffectSmooth 
                words={desktopTitleWords} 
                className="text-4xl md:text-6xl font-bold tracking-tight"
                cursorClassName="bg-purple-400 h-12"
              />
            )}
          </div>
          
          {/* 替换静态文本为顺序打字机效果 */}
          <div className="flex justify-center">
            <SequentialTypewriter 
              text="借助智能化&ldquo;词锚点域&rdquo;与大语言模型，构建属于你自己习得语料的宇宙！" 
              className="text-base sm:text-lg md:text-xl max-w-3xl mx-auto mb-6 sm:mb-8"
              delay={1200} // 假设标题完成后延迟1.5秒开始
            />
          </div>
          
          <AnimatedButton />
        </div>
        
        {/* 移动端不再需要额外空间，使用flexbox自动居中 */}
      </section>

      {/* Features */}
      <div ref={featuresRef} className={`${isMobile ? 'pt-16' : ''} relative z-10`}>
        <Features />
      </div>

      {/* How it Works */}
      <div ref={howItWorksRef} className="relative z-10">
        <HowItWorks />
      </div>

      {/* 添加页脚 */}
      <footer className="w-full py-8 mt-auto border-t border-gray-900 relative z-10 bg-black">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center space-y-2 text-sm text-gray-500">
            <div>© 2025 洪流二语习得. 保留所有权利.</div>
            <div className="flex items-center space-x-1">
              <a 
                href="https://beian.miit.gov.cn/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-gray-400 transition-colors"
              >
                鄂ICP备2024085025号-2
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}