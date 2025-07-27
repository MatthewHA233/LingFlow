'use client';

import { BookOpen, Headphones, Network, Brain } from 'lucide-react';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FEATURES_DATA } from '@/lib/constants/features';

export function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [centerRow, setCenterRow] = useState<number>(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 检测是否是移动设备
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // 渐入动画观察器
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

    // 滚动处理函数
    const handleScroll = () => {
      if (!isMobile) return;
      
      const viewportCenter = window.innerHeight / 2;
      let closestRow = -1;
      let minDistance = Infinity;
      
      // 检查所有卡片，找到最接近中心的行
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        
        const rect = card.getBoundingClientRect();
        // 只考虑在视口内的卡片
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          const cardCenter = rect.top + rect.height / 2;
          const distance = Math.abs(cardCenter - viewportCenter);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestRow = Math.floor(index / 2);
          }
        }
      });
      
      if (closestRow !== -1 && closestRow !== centerRow) {
        setCenterRow(closestRow);
      }
    };

    // 设置观察器
    cardRefs.current.forEach((card) => {
      if (card) {
        fadeObserver.observe(card);
      }
    });
    
    // 添加滚动监听（仅移动端）
    let scrollTimer: NodeJS.Timeout;
    const debouncedScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(handleScroll, 50);
    };
    
    if (isMobile) {
      // 查找滚动容器
      const scrollContainer = document.querySelector('.overflow-auto');
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', debouncedScroll);
      } else {
        window.addEventListener('scroll', debouncedScroll);
      }
      
      // 初始检测
      setTimeout(handleScroll, 200);
    }

    return () => {
      fadeObserver.disconnect();
      window.removeEventListener('resize', checkMobile);
      
      // 清理滚动监听
      clearTimeout(scrollTimer);
      const scrollContainer = document.querySelector('.overflow-auto');
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', debouncedScroll);
      } else {
        window.removeEventListener('scroll', debouncedScroll);
      }
    };
  }, [isMobile, centerRow]);

  return (
    <section 
      ref={sectionRef} 
      className="py-12 sm:py-16 md:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 w-full"
    >
      <div className="max-w-7xl mx-auto w-full">
        {/* 标题部分 */}
        <div className="text-center mb-10 sm:mb-16 md:mb-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-gray-100 mb-3 sm:mb-4 md:mb-6">
            核心特性
          </h2>
          <p className="text-gray-500 text-sm sm:text-base md:text-lg max-w-3xl mx-auto px-4">
            发现洪流二语习得的强大功能，开启你的沉浸式语言学习之旅
          </p>
        </div>
        
        {/* 功能卡片网格 - 移动端2列，桌面端4列 */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {FEATURES_DATA.map((feature, index) => (
            <div 
              key={feature.title}
              ref={el => {
                if (el) cardRefs.current[index] = el;
              }}
              className="opacity-0 group relative"
              onMouseEnter={() => !isMobile && setHoveredIndex(index)}
              onMouseLeave={() => !isMobile && setHoveredIndex(null)}
            >
              {/* 默认状态的紫色光晕 */}
              <div className={`
                absolute inset-0 rounded-2xl sm:rounded-3xl transition-opacity duration-300
                ${(hoveredIndex === index || (isMobile && centerRow === Math.floor(index / 2))) ? 'opacity-0' : 'opacity-100'}
              `}
                style={{
                  background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
                  filter: 'blur(40px)'
                }}
              />
              <div className={`
                relative h-full p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border sm:border-2 transition-all duration-200
                ${(hoveredIndex === index || (isMobile && centerRow === Math.floor(index / 2)))
                  ? 'border-transparent shadow-lg shadow-purple-500/20' 
                  : 'border-purple-500/20 bg-gray-900/30'
                }
              `}
                style={{
                  background: (hoveredIndex === index || (isMobile && centerRow === Math.floor(index / 2)))
                    ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(236, 72, 153, 0.05) 50%, rgba(168, 85, 247, 0.05) 100%)'
                    : '',
                  borderImage: (hoveredIndex === index || (isMobile && centerRow === Math.floor(index / 2)))
                    ? 'linear-gradient(135deg, rgb(168, 85, 247) 0%, rgb(236, 72, 153) 50%, rgb(168, 85, 247) 100%) 1'
                    : 'none'
                }}
              >
                {/* 图标 */}
                <div className="mb-3 sm:mb-4 lg:mb-6">
                  <div className={`
                    inline-flex p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-200
                    ${(hoveredIndex === index || (isMobile && centerRow === Math.floor(index / 2)))
                      ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' 
                      : ''}
                  `}>
                    <feature.icon className={`
                      h-5 w-5 sm:h-6 sm:w-6 transition-all duration-200
                      ${(hoveredIndex === index || (isMobile && centerRow === Math.floor(index / 2)))
                        ? 'text-transparent bg-gradient-to-br from-purple-400 to-pink-400 bg-clip-text' 
                        : 'text-purple-400'}
                    `} strokeWidth={1.5} 
                      style={{
                        stroke: (hoveredIndex === index || (isMobile && centerRow === Math.floor(index / 2)))
                          ? 'url(#purple-gradient)' 
                          : 'currentColor'
                      }}
                    />
                  </div>
                </div>
                
                {/* 渐变定义 */}
                <svg width="0" height="0">
                  <defs>
                    <linearGradient id="purple-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="50%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
                
                {/* 标题 */}
                <h3 className="text-base sm:text-lg lg:text-xl font-medium mb-2 sm:mb-3 text-gray-100">
                  {feature.title}
                </h3>
                
                {/* 描述 */}
                <p className="text-gray-400 text-[10px] leading-relaxed sm:text-sm">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}