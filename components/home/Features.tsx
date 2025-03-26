'use client';

import { BookOpen, Headphones, Network, Brain } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FEATURES_DATA } from '@/lib/constants/features';

// 确保注册ScrollTrigger插件
gsap.registerPlugin(ScrollTrigger);

export function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const cards = cardRefs.current;
    const section = sectionRef.current;
    
    // 检测当前节是否可见的函数
    const checkVisibility = () => {
      if (!section) return;
      
      const rect = section.getBoundingClientRect();
      // 如果元素顶部在视口内或刚好在视口下方
      const isInView = rect.top < window.innerHeight && rect.bottom >= 0;
      setIsVisible(isInView);
    };
    
    // 在滚动容器上添加监听
    const scrollContainer = document.querySelector('.overflow-auto');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkVisibility);
      // 初始检查
      requestAnimationFrame(checkVisibility);
    }
    
    // 标题动画
    if (titleRef.current) {
      gsap.fromTo(titleRef.current,
        { 
          y: -30,
          opacity: 0 
        },
        {
          y: 0,
          opacity: 1,
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: titleRef.current,
            start: 'top bottom-=100',
            scroller: '.overflow-auto',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }

    // 创建时间线动画，让所有卡片一起动画更流畅
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top bottom-=100',
        scroller: '.overflow-auto',
        toggleActions: 'play none none reverse'
      }
    });
    
    // 将所有卡片添加到同一个时间线
    cards.forEach((card, index) => {
      if (!card) return;

      // 添加发光效果
      const iconGlow = document.createElement('div');
      iconGlow.className = 'absolute inset-0 opacity-0 bg-primary/30 blur-xl';
      
      const iconContainer = card.querySelector('.icon-container');
      if (iconContainer) {
        const container = iconContainer as HTMLElement;
        container.style.position = 'relative';
        container.appendChild(iconGlow);
      }
      
      // 添加到时间线，使动画更加流畅
      tl.fromTo(card,
        {
          y: 40,
          opacity: 0,
          scale: 0.95
        },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.7,
          ease: "back.out(1.2)",
        }, 
        index * 0.08 // 减小延迟，让卡片之间衔接更紧密
      );

      // 鼠标悬停动画
      card.addEventListener('mouseenter', () => {
        gsap.to(iconGlow, {
          opacity: 1,
          duration: 0.3
        });
        gsap.to(card, {
          y: -5,
          scale: 1.02,
          duration: 0.3
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(iconGlow, {
          opacity: 0,
          duration: 0.3
        });
        gsap.to(card, {
          y: 0,
          scale: 1,
          duration: 0.3
        });
      });
    });
    
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', checkVisibility);
      }
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return (
    <section 
      ref={sectionRef} 
      className={`py-16 px-4 sm:px-6 lg:px-8 w-full ${isVisible ? 'opacity-100' : 'opacity-70'} transition-opacity duration-500`}
    >
      <div className="max-w-7xl mx-auto w-full">
        <h2 
          ref={titleRef} 
          className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-white to-primary bg-clip-text text-transparent"
        >
          核心特性
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 w-full">
          {FEATURES_DATA.map((feature, index) => (
            <div 
              key={feature.title}
              ref={el => {
                if (el) cardRefs.current[index] = el;
              }}
              className="bg-card/50 backdrop-blur-sm p-6 rounded-lg border border-primary/10 transition-all duration-300"
            >
              <div className="icon-container h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm sm:text-base">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}