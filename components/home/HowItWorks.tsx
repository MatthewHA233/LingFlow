'use client';

import { FileText, Headphones, PlayCircle, UserPlus, BookOpen, Brain, Clock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const stepsElements = stepsRef.current;
    
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
          duration: 1,
          scrollTrigger: {
            trigger: titleRef.current,
            start: 'top bottom-=100',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }

    // 步骤动画
    stepsElements.forEach((step, index) => {
      if (!step) return;

      // 添加发光效果
      const iconGlow = document.createElement('div');
      iconGlow.className = 'absolute inset-0 opacity-0 bg-primary/30 blur-xl';
      
      // 使用类型守卫确保 iconContainer 是 HTMLElement
      const iconContainer = step.querySelector('.icon-container');
      if (iconContainer) {
        const container = iconContainer as HTMLElement;
        container.style.position = 'relative';
        container.appendChild(iconGlow);
      }

      // 入场动画
      gsap.fromTo(step,
        {
          x: index % 2 === 0 ? -50 : 50,
          y: 30,
          opacity: 0
        },
        {
          x: 0,
          y: 0,
          opacity: 1,
          duration: 1,
          delay: Math.floor(index / 2) * 0.2 + (index % 2) * 0.3,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: step,
            start: 'top bottom-=100',
            toggleActions: 'play none none reverse'
          }
        }
      );

      // 鼠标悬停动画
      step.addEventListener('mouseenter', () => {
        gsap.to(iconGlow, {
          opacity: 1,
          duration: 0.3
        });
        gsap.to(step, {
          y: -5,
          duration: 0.3
        });
      });

      step.addEventListener('mouseleave', () => {
        gsap.to(iconGlow, {
          opacity: 0,
          duration: 0.3
        });
        gsap.to(step, {
          y: 0,
          duration: 0.3
        });
      });
    });
  }, []);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <h2 ref={titleRef} className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
          使用步骤
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div 
              key={index}
              ref={el => stepsRef.current[index] = el}
              className="flex flex-col items-center text-center group"
            >
              <div className="icon-container h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 transition-colors group-hover:bg-primary/20">
                <step.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
