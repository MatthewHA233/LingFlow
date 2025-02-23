'use client';

import { Anchor } from "@/types/anchor";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import * as Portal from '@radix-ui/react-portal';
import { useState, useEffect } from 'react';
import type { MeaningBlock } from '@/types/anchor';

interface AnchorTooltipProps {
  children: React.ReactNode;
  anchor: Anchor;
}

export function AnchorTooltip({ children, anchor }: AnchorTooltipProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return (
      <>
        <div 
          role="button"
          tabIndex={0}
          className="touch-none"
          onTouchEnd={(e) => {
            e.preventDefault();
            setIsOpen(!isOpen);
          }}
          onClick={(e) => {
            e.preventDefault();
            setIsOpen(!isOpen);
          }}
        >
          {children}
        </div>
        {isOpen && (
          <Portal.Root>
            <div 
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998]"
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
              }}
            />
            <div 
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-80 
                p-0 backdrop-blur-xl bg-black/40 border-none shadow-2xl rounded-lg z-[99999]"
              onTouchEnd={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
                {anchor.meaningBlocks.map((block, index) => (
                  <div key={block.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white/90">
                        {block.meaning}
                      </div>
                      <div 
                        className={`text-xs px-2 py-0.5 rounded-full
                          ${block.proficiency >= 80 ? 'bg-green-500/20 text-green-300' :
                            block.proficiency >= 60 ? 'bg-blue-500/20 text-blue-300' :
                            block.proficiency >= 40 ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-red-500/20 text-red-300'}`}
                      >
                        {block.proficiency}%
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {block.contexts.map((context, i) => (
                        <div key={i} className="text-xs space-y-1">
                          <div className="text-white/80 font-mono">
                            {context.text}
                          </div>
                          <div className="flex items-center justify-between text-white/40">
                            <span>{context.source}</span>
                            <span>{new Date(context.date).toLocaleDateString('zh-CN')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {index < anchor.meaningBlocks.length - 1 && (
                      <div className="border-t border-white/10 my-2" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Portal.Root>
        )}
      </>
    );
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <Portal.Root>
        <HoverCardContent 
          className="w-80 p-0 backdrop-blur-xl bg-black/40 border-none shadow-2xl"
          style={{
            maxHeight: 'calc(75vh)',
            overflow: 'auto',
            position: 'fixed',
            zIndex: 99999,
            pointerEvents: 'auto',
          }}
          sideOffset={5}
        >
          <div className="p-4 space-y-3">
            {anchor.meaningBlocks.map((block, index) => (
              <div key={block.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/90">
                    {block.meaning}
                  </div>
                  <div 
                    className={`text-xs px-2 py-0.5 rounded-full
                      ${block.proficiency >= 80 ? 'bg-green-500/20 text-green-300' :
                        block.proficiency >= 60 ? 'bg-blue-500/20 text-blue-300' :
                        block.proficiency >= 40 ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-red-500/20 text-red-300'}`}
                  >
                    {block.proficiency}%
                  </div>
                </div>
                <div className="space-y-1.5">
                  {block.contexts.map((context, i) => (
                    <div key={i} className="text-xs space-y-1">
                      <div className="text-white/80 font-mono">
                        {context.text}
                      </div>
                      <div className="flex items-center justify-between text-white/40">
                        <span>{context.source}</span>
                        <span>{new Date(context.date).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {index < anchor.meaningBlocks.length - 1 && (
                  <div className="border-t border-white/10 my-2" />
                )}
              </div>
            ))}
          </div>
        </HoverCardContent>
      </Portal.Root>
    </HoverCard>
  );
} 