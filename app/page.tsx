'use client';
import { useEffect, useState } from 'react';
import { AnimatedButton } from '@/components/ui/animated-button';
import { Features } from '@/components/home/Features';
import { HowItWorks } from '@/components/home/HowItWorks';
import { MatrixBackground } from '@/components/home/MatrixBackground';
import { TypewriterEffectSmooth } from '@/components/ui/typewriter-effect';
import { SequentialTypewriter } from '@/components/ui/typewriter-text';

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);

  // 检测设备尺寸
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <MatrixBackground />
      
      {/* Hero Section - 修复移动端高度问题 */}
      <section className={`${isMobile ? 'min-h-[100vh]' : 'py-40'} flex-1 flex flex-col items-center justify-center pt-32 pb-10 sm:py-40 px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-7xl mx-auto text-center">
          {/* 根据设备类型显示不同的标题 */}
          <div className="mb-4 px-2">
            {isMobile ? (
              // 移动端显示紧凑的两行打字机效果，确保居中
              <div className="space-y-2 max-w-xs mx-auto text-center">
                <div className="flex justify-center">
                  <TypewriterEffectSmooth 
                    words={mobileTitleWords} 
                    className="text-3xl font-bold tracking-tight text-center"
                    cursorClassName="bg-purple-400 h-6 hidden"
                  />
                </div>
                <div className="flex justify-center">
                  <TypewriterEffectSmooth 
                    words={mobileSubtitleWords} 
                    className="text-xl font-bold tracking-tight text-center"
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
        
        {/* 移动端添加额外空间，推动Features完全移出初始视图 */}
        {isMobile && <div className="mt-auto h-32"></div>}
      </section>

      {/* Features - 调整移动端距离 */}
      <div className={isMobile ? 'pt-16' : ''}>
        <Features />
      </div>

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