'use client';

import { FileText, Headphones, PlayCircle, UserPlus, BookOpen, Brain, Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const steps = [
  {
    icon: UserPlus,
    title: '注册账号',
    description: '支持手机号注册和微信一键登录，快速开始您的学习之旅'
  },
  {
    icon: FileText,
    title: '导入电子书',
    description: '支持EPUB等多种格式，自动提取文本和封面，智能排版成Markdown格式'
  },
  {
    icon: Headphones,
    title: '添加音频',
    description: '上传有声书音频，智能识别文本并自动对齐，或使用高质量AI配音'
  },
  {
    icon: BookOpen,
    title: '开始阅读',
    description: '选择感兴趣的地方，开始模块化点读，通过大量的听和阅读的可理解性输入，习得第二语言'
  },
  {
    icon: Brain,
    title: '词锚点采集',
    description: '通过手动框选和智能预测建立词锚点，从语境中大量迭代对词汇短语的理解，并将这个过程可视化和量化'
  },
  {
    icon: Clock,
    title: '科学复习',
    description: '通过基于语境、辨析集锦、词锚点数据的智能间隔重复算法，安排复习，巩固学习效果'
  }
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [centerIndex, setCenterIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 检测是否是移动设备
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const fadeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in-up');
          }
        });
      },
      { threshold: 0.1 }
    );

    // 中心检测观察器（仅移动端）
    const centerObserver = new IntersectionObserver(
      (entries) => {
        if (!isMobile) return;
        
        let maxRatio = 0;
        let centerCard = null;
        
        entries.forEach((entry) => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            centerCard = entry.target;
          }
        });
        
        if (centerCard) {
          const index = stepsRef.current.findIndex(step => step === centerCard);
          if (index !== -1) {
            // 计算所在行（每行2个）
            const row = Math.floor(index / 2);
            setCenterIndex(row);
          }
        }
      },
      { 
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: '-45% 0px -45% 0px'
      }
    );

    stepsRef.current.forEach((step) => {
      if (step) {
        fadeObserver.observe(step);
        if (isMobile) {
          centerObserver.observe(step);
        }
      }
    });

    return () => {
      fadeObserver.disconnect();
      centerObserver.disconnect();
      window.removeEventListener('resize', checkMobile);
    };
  }, [isMobile]);

  return (
    <section 
      ref={sectionRef} 
      className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 w-full relative"
    >
      <div className="max-w-7xl mx-auto w-full">
        <div className="text-center mb-10 sm:mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4 text-white">
            使用步骤
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto px-4">
            简单几步，开启您的沉浸式语言学习之旅
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {steps.map((step, index) => (
            <div 
              key={index}
              ref={el => { stepsRef.current[index] = el; }}
              className="opacity-0 transition-all duration-300 relative h-full"
              onMouseEnter={() => !isMobile && setHoveredIndex(index)}
              onMouseLeave={() => !isMobile && setHoveredIndex(null)}
            >
              {/* 默认状态的紫色光晕 */}
              <div className={`
                absolute inset-0 rounded-3xl transition-opacity duration-300
                ${(hoveredIndex === index || (isMobile && centerIndex === Math.floor(index / 2))) ? 'opacity-0' : 'opacity-60'}
              `}
                style={{
                  background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.06) 0%, transparent 70%)',
                  filter: 'blur(30px)'
                }}
              />
              <div className={`
                relative h-full p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl border sm:border-2 transition-all duration-200
                ${(hoveredIndex === index || (isMobile && centerIndex === Math.floor(index / 2)))
                  ? 'border-transparent shadow-lg shadow-purple-500/20' 
                  : 'border-purple-500/20'
                }
              `}
                style={{
                  backdropFilter: 'blur(12px)',
                  background: (hoveredIndex === index || (isMobile && centerIndex === Math.floor(index / 2)))
                    ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(236, 72, 153, 0.15) 50%, rgba(168, 85, 247, 0.15) 100%)'
                    : 'rgba(0, 0, 0, 0.5)',
                  borderImage: (hoveredIndex === index || (isMobile && centerIndex === Math.floor(index / 2)))
                    ? 'linear-gradient(135deg, rgb(168, 85, 247) 0%, rgb(236, 72, 153) 50%, rgb(168, 85, 247) 100%) 1'
                    : 'none'
                }}
              >
                <div className="flex flex-col items-center text-center h-full">
                  <div className={`
                    h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4
                    transition-all duration-300
                    ${(hoveredIndex === index || (isMobile && centerIndex === Math.floor(index / 2)))
                      ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' 
                      : 'bg-purple-500/10'}
                  `}>
                    <step.icon className={`
                      h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 transition-all duration-300
                      ${(hoveredIndex === index || (isMobile && centerIndex === Math.floor(index / 2))) 
                        ? 'text-transparent bg-gradient-to-br from-purple-400 to-pink-400 bg-clip-text' 
                        : 'text-purple-400/70'}
                    `} strokeWidth={1.5} 
                      style={{
                        stroke: (hoveredIndex === index || (isMobile && centerIndex === Math.floor(index / 2)))
                          ? 'url(#purple-gradient-how)' 
                          : 'currentColor'
                      }}
                    />
                  </div>
                  <div className={`
                    absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full 
                    flex items-center justify-center text-xs sm:text-sm font-bold
                    transition-all duration-300 border sm:border-2
                    ${(hoveredIndex === index || (isMobile && centerIndex === Math.floor(index / 2)))
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white border-black' 
                      : 'bg-gray-800/80 text-gray-400 border-gray-700'
                    }
                  `}>
                    {index + 1}
                  </div>
                  <h3 className="text-sm sm:text-base md:text-xl font-semibold mb-2 sm:mb-3 text-white">
                    {step.title}
                  </h3>
                  <p className="text-gray-300 text-[10px] leading-relaxed sm:text-sm md:text-base sm:line-clamp-3 md:line-clamp-none mt-auto">
                    {step.description}
                  </p>
                </div>
                
                {/* 渐变定义 */}
                <svg width="0" height="0" className="absolute">
                  <defs>
                    <linearGradient id="purple-gradient-how" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="50%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
