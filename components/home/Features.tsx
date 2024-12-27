'use client';

import { BookOpen, Headphones, Network, Brain } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/use-scroll-animation';
import { useHoverAnimation } from '@/hooks/use-hover-animation';
import { FEATURES_DATA } from '@/lib/constants/features';

export function Features() {
  const sectionRef = useScrollAnimation<HTMLDivElement>();
  const cardRefs = FEATURES_DATA.map(() => useHoverAnimation<HTMLDivElement>());

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8" ref={sectionRef}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {FEATURES_DATA.map((feature, index) => (
            <div 
              key={feature.title}
              ref={cardRefs[index]}
              className="bg-card/50 backdrop-blur-sm p-6 rounded-lg border border-primary/10 overflow-hidden"
            >
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
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