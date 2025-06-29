'use client';

import { Anchor } from "@/types/anchor";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import * as Portal from '@radix-ui/react-portal';
import { useState, useEffect } from 'react';
import { smartHighlightWord, formatPartOfSpeech } from '@/lib/utils/text-highlight';
import type { MeaningBlock } from '@/types/anchor';

interface AnchorTooltipProps {
  children: React.ReactNode;
  anchor: Anchor;
  currentDate?: string;
  globalCollapsed?: boolean;
  onGlobalCollapsedChange?: (collapsed: boolean) => void;
}

export function AnchorTooltip({ 
  children, 
  anchor, 
  currentDate, 
  globalCollapsed,
  onGlobalCollapsedChange 
}: AnchorTooltipProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 当全局状态改变时，同步本地状态
  useEffect(() => {
    if (globalCollapsed !== undefined) {
      setIsCollapsed(globalCollapsed);
    }
  }, [globalCollapsed]);

  // 安全检查，确保meaning_blocks存在
  const meaningBlocks = anchor.meaning_blocks || [];
  
  // 检查是否是当前日期创建的（如果没有传入currentDate，则不高亮任何内容）
  const isCreatedOnDate = (dateString: string, targetDate?: string) => {
    if (!targetDate) return false;
    return dateString.split('T')[0] === targetDate;
  };

  // 渲染含义块的函数
  const renderMeaningBlock = (block: MeaningBlock, index: number) => {
    const isTodayBlock = isCreatedOnDate(block.created_at, currentDate);
    const partOfSpeech = formatPartOfSpeech(block.tags);
    
    return (
      <div key={block.id} className="space-y-2">
        {!isCollapsed && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* 词性标签 */}
              {partOfSpeech && (
                <span className={`text-xs px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 ${
                  isTodayBlock ? 'text-blue-300' : 'text-blue-400/80'
                }`}>
                  {partOfSpeech}
                </span>
              )}
              {/* 含义 */}
              <div className={`text-sm ${isTodayBlock ? 'text-green-300' : 'text-white/90'}`}>
                {block.meaning}
              </div>
            </div>
            {/* 熟练度 */}
            <div 
              className={`text-xs px-2 py-0.5 rounded-full
                ${(block.current_proficiency * 100) >= 80 ? 'bg-green-500/20 text-green-300' :
                  (block.current_proficiency * 100) >= 60 ? 'bg-blue-500/20 text-blue-300' :
                  (block.current_proficiency * 100) >= 40 ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-red-500/20 text-red-300'}`}
            >
              {Math.round(block.current_proficiency * 100)}%
            </div>
          </div>
        )}
        
        {/* 例句部分 */}
        <div className="space-y-1.5">
          {block.contexts && block.contexts.length > 0 ? block.contexts.map((context, i) => {
            const isTodayContext = context.context_block?.created_at && isCreatedOnDate(context.context_block.created_at, currentDate);
            const sentence = context.original_sentence || context.context_explanation || context.context_block?.content || '语境内容';
            
            // 使用 original_word_form 进行高亮，如果没有则回退到锚点的 text
            const wordToHighlight = context.original_word_form || anchor.text;
            
            return (
              <div key={i} className="text-xs space-y-1">
                {/* 高亮显示的例句 */}
                <div className={`font-mono ${isTodayContext ? 'text-green-300' : 'text-white/70'}`}>
                  {smartHighlightWord(sentence, wordToHighlight, {
                    className: 'font-bold underline text-red-400',
                    caseSensitive: false,
                    wholeWord: true
                  })}
                </div>
                
                {/* 语境解释 */}
                {!isCollapsed && context.original_sentence && context.context_explanation && (
                  <div className={`text-xs italic ${isTodayContext ? 'text-green-400/80' : 'text-white/50'}`}>
                    {context.context_explanation}
                  </div>
                )}
                
                {/* 元信息 */}
                {!isCollapsed && (
                  <div className={`text-right ${isTodayContext ? 'text-green-400/60' : 'text-white/40'}`}>
                    <span>{new Date(context.context_block?.created_at || Date.now()).toLocaleDateString('zh-CN')}</span>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="text-xs text-white/60">暂无语境信息</div>
          )}
        </div>
        
        {/* 分隔线 */}
        {!isCollapsed && index < meaningBlocks.length - 1 && (
          <div className="border-t border-white/10 my-2" />
        )}
      </div>
    );
  };

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
                {meaningBlocks.length > 0 ? 
                  meaningBlocks.map((block, index) => renderMeaningBlock(block, index)) : 
                  <div className="text-sm text-white/60">暂无含义信息</div>
                }
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
            {meaningBlocks.length > 0 ? 
              meaningBlocks.map((block, index) => renderMeaningBlock(block, index)) : 
              <div className="text-sm text-white/60">暂无含义信息</div>
            }
          </div>
        </HoverCardContent>
      </Portal.Root>
    </HoverCard>
  );
} 