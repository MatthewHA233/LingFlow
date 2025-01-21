'use client';

import { BookOpen, Headphones, Network, Brain } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/use-scroll-animation';
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { FEATURES_DATA } from '@/lib/constants/features';

export function Features() {
  const sectionRef = useScrollAnimation<HTMLDivElement>();
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const cards = cardRefs.current;

    cards.forEach((card) => {
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
  }, []);

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8" ref={sectionRef}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {FEATURES_DATA.map((feature, index) => (
            <div 
              key={feature.title}
              ref={el => cardRefs.current[index] = el}
              className="bg-card/50 backdrop-blur-sm p-6 rounded-lg border border-primary/10 overflow-hidden transition-all duration-300"
            >
              <div className="icon-container h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}