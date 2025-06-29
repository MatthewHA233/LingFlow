import React, { useMemo, useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { type MeaningBlockFormatted } from '@/lib/services/meaning-blocks-service';

interface AnchorHighlightRendererProps {
  content: string;
  meaningBlocks: MeaningBlockFormatted[];
  className?: string;
}

interface AnchorRange {
  start: number;
  end: number;
  meaningBlock: MeaningBlockFormatted;
  text: string;
}

// 悬浮窗口组件
interface MeaningBlockTooltipProps {
  meaningBlock: MeaningBlockFormatted;
  position: { top: number; left: number };
  isExpanded: boolean; // 简化为布尔值：false=简洁, true=展开
  onExpand: () => void;
  onClose: () => void;
}

function MeaningBlockTooltip({ meaningBlock, position, isExpanded, onExpand, onClose }: MeaningBlockTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 animate-in fade-in-0 zoom-in-95 duration-200"
      style={{ top: position.top, left: position.left }}
    >
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-md px-2 py-1 shadow-lg max-w-xs">
        {/* 基础信息 */}
        <div 
          className={cn(
            "transition-colors rounded px-1 py-0.5",
            !isExpanded && "cursor-pointer hover:bg-muted/50"
          )}
          onClick={!isExpanded ? onExpand : undefined}
        >
          <span className="text-xs text-muted-foreground">
            {meaningBlock.tags && meaningBlock.tags.length > 0 
              ? meaningBlock.tags[0] + '.'  // 使用第一个词性标签，如 "noun."
              : (meaningBlock.anchor_type === 'word' ? 'n.' : 'phrase.')
            }
            {isExpanded && meaningBlock.phonetic && (
              <span className="font-mono ml-1">[{meaningBlock.phonetic}]</span>
            )}
          </span>
          <span className="text-sm ml-1">
            {meaningBlock.chinese_meaning}
          </span>
          {isExpanded && meaningBlock.context_explanation && (
            <div className="text-xs text-muted-foreground mt-1 border-t pt-1">
              {meaningBlock.context_explanation}
            </div>
          )}
        </div>

        {/* 展开后的熟练度信息 */}
        {isExpanded && (
          <div className="border-t mt-1 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">复习 {meaningBlock.review_count} 次</span>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">熟练度</span>
                <div 
                  className={cn(
                    "w-2 h-2 rounded-full border border-white/20",
                    meaningBlock.current_proficiency >= 80 ? "bg-green-500" :
                    meaningBlock.current_proficiency >= 60 ? "bg-yellow-500" :
                    meaningBlock.current_proficiency >= 40 ? "bg-orange-500" :
                    "bg-red-500"
                  )}
                  title={`熟练度: ${meaningBlock.current_proficiency}`}
                />
                <span className="text-muted-foreground text-xs">{meaningBlock.current_proficiency}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 中文分词简化版本
const segmentChinese = (text: string): Array<{text: string, start: number, end: number}> => {
  const segments: Array<{text: string, start: number, end: number}> = [];
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    
    // 保留空白字符
    if (/\s/.test(char)) {
      segments.push({ text: char, start: i, end: i + 1 });
      i++;
      continue;
    }
    
    // 处理英文单词
    if (/[a-zA-Z]/.test(char)) {
      const wordStart = i;
      while (i < text.length && /[a-zA-Z]/.test(text[i])) {
        i++;
      }
      segments.push({ text: text.slice(wordStart, i), start: wordStart, end: i });
      continue;
    }
    
    // 处理数字
    if (/[0-9]/.test(char)) {
      const numStart = i;
      while (i < text.length && /[0-9.]/.test(text[i])) {
        i++;
      }
      segments.push({ text: text.slice(numStart, i), start: numStart, end: i });
      continue;
    }
    
    // 处理标点符号
    if (/[，。！？；：""''（）【】《》、]/.test(char)) {
      segments.push({ text: char, start: i, end: i + 1 });
      i++;
      continue;
    }
    
    // 中文字符
    if (/[\u4e00-\u9fff]/.test(char)) {
      segments.push({ text: char, start: i, end: i + 1 });
      i++;
      continue;
    }
    
    // 其他字符
    segments.push({ text: char, start: i, end: i + 1 });
    i++;
  }
  
  return segments;
};

export function AnchorHighlightRenderer({ 
  content, 
  meaningBlocks, 
  className 
}: AnchorHighlightRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);
  
  // 悬浮窗口状态
  const [tooltip, setTooltip] = useState<{
    meaningBlock: MeaningBlockFormatted;
    position: { top: number; left: number };
    isExpanded: boolean;
  } | null>(null);
  
  // hover延迟处理
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 添加强制重新渲染的key，基于meaningBlocks的内容
  const renderKey = useMemo(() => {
    return meaningBlocks.map(mb => `${mb.id}-${mb.updated_at}`).join('-');
  }, [meaningBlocks]);

  // 处理锚点范围
  const anchorRanges = useMemo(() => {
    const ranges: AnchorRange[] = [];
    
    meaningBlocks.forEach(meaningBlock => {
      if (meaningBlock.start_position != null && meaningBlock.end_position != null) {
        const start = meaningBlock.start_position;
        const end = meaningBlock.end_position;
        const text = content.slice(start, end);
        
        ranges.push({ start, end, meaningBlock, text });
      }
    });
    
    return ranges.sort((a, b) => a.start - b.start);
  }, [content, meaningBlocks, renderKey]); // 添加renderKey依赖

  // 分词处理
  const wordSegments = useMemo(() => segmentChinese(content), [content, renderKey]); // 添加renderKey依赖

  // 检查segment是否在锚点范围内
  const getSegmentAnchorInfo = (segment: {text: string, start: number, end: number}) => {
    for (const range of anchorRanges) {
      if (segment.start >= range.start && segment.end <= range.end) {
        const segmentsInRange = wordSegments.filter(seg => 
          seg.start >= range.start && seg.end <= range.end &&
          !/[，。！？；：""''（）【】《》、\s]/.test(seg.text)
        );
        
        return {
          isInAnchor: true,
          anchorRange: range,
          isPhrase: segmentsInRange.length > 1
        };
      }
    }
    return { isInAnchor: false, anchorRange: null, isPhrase: false };
  };

  // 获取短语边框信息
  const getPhraseRanges = useMemo(() => {
    const phraseRanges: Array<{
      anchorRange: AnchorRange;
      segmentIndices: number[];
    }> = [];

    anchorRanges.forEach(anchorRange => {
      const segmentIndices: number[] = [];
      
      wordSegments.forEach((segment, index) => {
        if (segment.start >= anchorRange.start && 
            segment.end <= anchorRange.end &&
            !/[，。！？；：""''（）【】《》、\s]/.test(segment.text)) {
          segmentIndices.push(index);
        }
      });

      if (segmentIndices.length > 1) {
        phraseRanges.push({ anchorRange, segmentIndices });
      }
    });

    return phraseRanges;
  }, [anchorRanges, wordSegments, renderKey]); // 添加renderKey依赖

  // 计算悬浮窗口位置
  const calculateTooltipPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.bottom + 8,
      left: rect.left + (rect.width / 2) - 60 // 大概居中
    };
  };

  // 处理锚点hover
  const handleAnchorHover = (anchorRange: AnchorRange, element: HTMLElement) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      const position = calculateTooltipPosition(element);
      setTooltip({ 
        meaningBlock: anchorRange.meaningBlock, 
        position,
        isExpanded: false
      });
    }, 300);
  };

  // 处理锚点离开
  const handleAnchorLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      setTooltip(null);
    }, 200);
  };

  // 处理悬浮窗口hover
  const handleTooltipHover = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  // 展开悬浮窗口
  const expandTooltip = () => {
    if (tooltip) {
      setTooltip({ ...tooltip, isExpanded: true });
    }
  };

  // 关闭悬浮窗口
  const closeTooltip = () => {
    setTooltip(null);
  };

  // 强制清理refs当meaningBlocks变化时
  useEffect(() => {
    segmentRefs.current = [];
    setTooltip(null); // 清除悬浮窗口
  }, [renderKey]);

  // 渲染内容
  const renderContent = () => {
    if (anchorRanges.length === 0) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    // 修复：正确调用getPhraseRanges
    const phraseRanges = getPhraseRanges;
    
    return (
      <span className="relative" ref={containerRef} key={renderKey}>
        {/* 渲染短语边框 */}
        {phraseRanges.map((phraseRange, rangeIndex) => {
          const segmentRects: Array<{rect: DOMRect, index: number}> = [];
          
          phraseRange.segmentIndices.forEach(segmentIndex => {
            const ref = segmentRefs.current[segmentIndex];
            if (ref && containerRef.current) {
              const rect = ref.getBoundingClientRect();
              segmentRects.push({ rect, index: segmentIndex });
            }
          });
          
          if (segmentRects.length === 0 || !containerRef.current) {
            return null;
          }
          
          const containerRect = containerRef.current.getBoundingClientRect();
          
          // 按行分组segments
          const lineGroups: Array<Array<{rect: DOMRect, index: number}>> = [];
          let currentLine: Array<{rect: DOMRect, index: number}> = [];
          let currentTop = segmentRects[0].rect.top;
          
          segmentRects.forEach(segmentRect => {
            if (Math.abs(segmentRect.rect.top - currentTop) > 10) {
              if (currentLine.length > 0) {
                lineGroups.push(currentLine);
              }
              currentLine = [segmentRect];
              currentTop = segmentRect.rect.top;
            } else {
              currentLine.push(segmentRect);
            }
          });
          
          if (currentLine.length > 0) {
            lineGroups.push(currentLine);
          }
          
          // 为每一行渲染边框
          return lineGroups.map((lineSegments, lineIndex) => {
            const firstSegment = lineSegments[0];
            const lastSegment = lineSegments[lineSegments.length - 1];
            
            const left = firstSegment.rect.left - containerRect.left - 4;
            const width = lastSegment.rect.right - firstSegment.rect.left + 8;
            const top = firstSegment.rect.top - containerRect.top - 4;
            const height = firstSegment.rect.height + 8;
            
            return (
              <div
                key={`phrase-border-${phraseRange.anchorRange.meaningBlock.id}-${rangeIndex}-line-${lineIndex}-${renderKey}`}
                className="absolute border-2 rounded-md pointer-events-none"
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  top: `${top}px`,
                  height: `${height}px`,
                  zIndex: 1,
                  borderImage: 'linear-gradient(to right, rgb(99 102 241), rgb(168 85 247)) 1'
                }}
              />
            );
          });
        })}
        
        {/* 渲染文本segments */}
        {wordSegments.map((segment, index) => {
          const anchorInfo = getSegmentAnchorInfo(segment);
          const isPunctuation = /[，。！？；：""''（）【】《》、]/.test(segment.text);
          const isWhitespace = /\s/.test(segment.text);
          
          // 空白字符
          if (isWhitespace) {
            return <span key={`space-${index}-${renderKey}`}>{segment.text}</span>;
          }
          
          // 标点符号
          if (isPunctuation) {
            return (
              <span key={`punct-${index}-${renderKey}`} className="text-muted-foreground">
                {segment.text}
              </span>
            );
          }
          
          // 普通文本
          if (!anchorInfo.isInAnchor) {
            return (
              <span 
                key={`normal-${index}-${renderKey}`} 
                ref={(el) => { segmentRefs.current[index] = el; }}
                className="inline"
              >
                {segment.text}
              </span>
            );
          }
          
          // 锚点文本
          const { anchorRange, isPhrase } = anchorInfo;
          
          return (
            <span
              key={`anchor-${index}-${renderKey}`}
              ref={(el) => { segmentRefs.current[index] = el; }}
              className={cn(
                "relative inline transition-all duration-200 cursor-pointer",
                !isPhrase && "px-1 rounded-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm hover:scale-105",
                isPhrase && "inline"
              )}
              onMouseEnter={(e) => handleAnchorHover(anchorRange!, e.currentTarget)}
              onMouseLeave={handleAnchorLeave}
            >
              {segment.text}
              
              {/* 单词光晕效果 */}
              {!isPhrase && (
                <div className="absolute -inset-px bg-gradient-to-r from-blue-400 to-purple-400 rounded blur-sm -z-10 opacity-30" />
              )}
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <div className={cn("text-sm leading-relaxed whitespace-pre-wrap", className)}>
      {renderContent()}
      
      {/* 悬浮窗口 */}
      {tooltip && (
        <div
          onMouseEnter={handleTooltipHover}
          onMouseLeave={handleAnchorLeave}
        >
          <MeaningBlockTooltip
            meaningBlock={tooltip.meaningBlock}
            position={tooltip.position}
            isExpanded={tooltip.isExpanded}
            onExpand={expandTooltip}
            onClose={closeTooltip}
          />
        </div>
      )}
    </div>
  );
} 