import React, { useMemo, useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause } from 'lucide-react';
import { motion } from "framer-motion";
import { type MeaningBlockFormatted } from '@/lib/services/meaning-blocks-service';

interface AudioAnchorRendererProps {
  content: string;
  meaningBlocks: MeaningBlockFormatted[];
  embeddedSentences: Map<string, any>;
  activeIndex: number | null;
  activeWordId: string | null;
  currentAudioTime: number;
  isPlaying: boolean;
  onSentenceClick: (sentence: any, sentenceIndex: number) => void;
  onWordClick: (word: any, sentenceIndex: number, e: React.MouseEvent) => void;
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
  isExpanded: boolean;
  onExpand: () => void;
  onClose: () => void;
  audioContext?: 'playing' | 'paused' | 'idle';
}

function MeaningBlockTooltip({ meaningBlock, position, isExpanded, onExpand, onClose, audioContext = 'idle' }: MeaningBlockTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

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
      <div className={cn(
        "bg-background/95 backdrop-blur-sm border border-border rounded-md px-2 py-1 shadow-lg max-w-xs",
        audioContext === 'playing' && "border-emerald-400 shadow-emerald-200/50"
      )}>
        {/* 移除音频状态指示器文字，保留绿色边框效果 */}
        
        <div 
          className={cn(
            "transition-colors rounded px-1 py-0.5",
            !isExpanded && "cursor-pointer hover:bg-muted/50"
          )}
          onClick={!isExpanded ? onExpand : undefined}
        >
          <span className="text-xs text-muted-foreground">
            {meaningBlock.tags && meaningBlock.tags.length > 0 
              ? meaningBlock.tags[0] + '.'
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

export function AudioAnchorRenderer({ 
  content, 
  meaningBlocks, 
  embeddedSentences,
  activeIndex,
  activeWordId,
  currentAudioTime,
  isPlaying,
  onSentenceClick,
  onWordClick,
  className 
}: AudioAnchorRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [phraseBorders, setPhraseBorders] = useState<React.ReactNode[]>([]);
  const updateBordersTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  
  const [tooltip, setTooltip] = useState<{
    meaningBlock: MeaningBlockFormatted;
    position: { top: number; left: number };
    isExpanded: boolean;
  } | null>(null);
  
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 生成唯一的组件ID，避免多个组件间的干扰
  const componentId = useRef(Math.random().toString(36).substring(7));
  
  // 添加渲染计数器来跟踪重复渲染
  const renderCountRef = useRef(0);
  
  // 内部状态存储展开内容，避免全局变量污染
  const [expandedData, setExpandedData] = useState<{
    expandedContent: string;
    sentencePositions: Array<{
      sentenceId: string;
      startInExpanded: number;
      endInExpanded: number;
      startInOriginal: number;
      endInOriginal: number;
    }>;
  } | null>(null);

  // 简化的渲染键，避免过度重渲染
  const stableKey = useMemo(() => {
    return `${componentId.current}-${meaningBlocks.length}-${embeddedSentences.size}`;
  }, [meaningBlocks.length, embeddedSentences.size]);

  // 预处理展开内容 - 只在必要时重新计算
  useEffect(() => {
    if (!content.includes('[[') || embeddedSentences.size === 0) {
      setExpandedData(null);
      return;
    }

    const sentencePositions: Array<{
      sentenceId: string;
      startInExpanded: number;
      endInExpanded: number;
      startInOriginal: number;
      endInOriginal: number;
    }> = [];
    
    const pattern = /\[\[([a-f0-9-]+)\]\]/g;
    let match;
    let expandedText = '';
    let lastIndex = 0;
    
    // 逐步展开content
    while ((match = pattern.exec(content)) !== null) {
      // 添加句子前的文本
      const beforeText = content.substring(lastIndex, match.index);
      expandedText += beforeText;
      
      const sentenceId = match[1];
      const sentence = embeddedSentences.get(sentenceId);
      
      if (sentence) {
        const sentenceText = sentence.content || sentence.text_content || '';
        const startInExpanded = expandedText.length;
        expandedText += sentenceText;
        const endInExpanded = expandedText.length;
        
        sentencePositions.push({
          sentenceId,
          startInExpanded,
          endInExpanded,
          startInOriginal: match.index,
          endInOriginal: match.index + match[0].length
        });
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // 添加最后的文本
    expandedText += content.substring(lastIndex);
    
    setExpandedData({ expandedContent: expandedText, sentencePositions });
  }, [content, embeddedSentences]);

  // 处理锚点范围 - 基于内部状态重新计算位置
  const anchorRanges = useMemo(() => {
    const ranges: AnchorRange[] = [];
    
    if (expandedData?.expandedContent) {
      // 在展开内容中查找锚点 - 改进匹配逻辑
      meaningBlocks.forEach((meaningBlock, blockIndex) => {
        // 优先使用 original_word_form，如果没有则回退到 anchor_text
        const searchText = meaningBlock.original_word_form || meaningBlock.anchor_text;
        
        if (!searchText) return;
        
        // 如果有原始位置信息，尝试映射到展开内容中
        if (meaningBlock.start_position != null && meaningBlock.end_position != null) {
          // 找到原始位置对应的句子
          let targetPosition = -1;
          
          // 遍历句子位置，找到包含原始位置的句子
          for (const sentencePos of expandedData.sentencePositions) {
            if (meaningBlock.start_position >= sentencePos.startInOriginal && 
                meaningBlock.start_position < sentencePos.endInOriginal) {
              // 计算在句子内的相对位置
              const relativeStart = meaningBlock.start_position - sentencePos.startInOriginal;
              const relativeEnd = meaningBlock.end_position - sentencePos.startInOriginal;
              
              // 映射到展开内容中的位置
              const expandedStart = sentencePos.startInExpanded + relativeStart;
              const expandedEnd = sentencePos.startInExpanded + relativeEnd;
              
              // 验证文本是否匹配
              const extractedText = expandedData.expandedContent.substring(expandedStart, expandedEnd);
              // 使用原文形式进行匹配，如果没有则使用锚点文本
              const expectedText = meaningBlock.original_word_form || meaningBlock.anchor_text;
              if (extractedText === expectedText) {
                targetPosition = expandedStart;
                break;
              }
            }
          }
          
          // 如果找到了精确位置
          if (targetPosition !== -1) {
            const start = targetPosition;
            const end = targetPosition + searchText.length;
            ranges.push({ start, end, meaningBlock, text: searchText });
            return; // 找到精确位置就不用继续查找
          }
        }
        
        // 如果没有原始位置或映射失败，回退到文本搜索
        // 但使用更智能的搜索策略，避免重复匹配
        let searchStart = 0;
        let foundCount = 0;
        
        // 为了避免重复匹配，我们需要跳过已经匹配过的锚点
        const existingRanges = ranges.filter(r => r.text === searchText);
        
        // 使用不区分大小写的搜索
        const lowerSearchText = searchText.toLowerCase();
        const lowerExpandedContent = expandedData.expandedContent.toLowerCase();
        
        while (true) {
          const anchorIndex = lowerExpandedContent.indexOf(lowerSearchText, searchStart);
          if (anchorIndex === -1) break;
          
          // 检查是否与已有范围重叠
          const isOverlapping = existingRanges.some(existing => 
            !(anchorIndex >= existing.end || (anchorIndex + searchText.length) <= existing.start)
          );
          
          if (!isOverlapping) {
            const start = anchorIndex;
            const end = anchorIndex + searchText.length;
            // 使用原始展开内容中的实际文本作为匹配文本
            const actualText = expandedData.expandedContent.substring(start, end);
            ranges.push({ start, end, meaningBlock, text: actualText });
            break; // 找到一个就够了，避免重复
          }
          
          searchStart = anchorIndex + 1;
          foundCount++;
          
          // 防止无限循环
          if (foundCount > 10) break;
        }
      });
    } else if (!content.includes('[[')) {
      // 原有逻辑：如果没有嵌入句子，直接使用原始位置
      meaningBlocks.forEach((meaningBlock, index) => {
        if (meaningBlock.start_position != null && meaningBlock.end_position != null) {
          const start = meaningBlock.start_position;
          const end = meaningBlock.end_position;
          const text = content.slice(start, end);
          ranges.push({ start, end, meaningBlock, text });
        }
      });
    }
    
    // 只在首次渲染时输出统计信息
    if (ranges.length > 0) {
      renderCountRef.current++;
      console.log(`📊 [渲染${renderCountRef.current}] 组件${componentId.current} 锚点匹配统计: ${ranges.length}/${meaningBlocks.length} (${(ranges.length / meaningBlocks.length * 100).toFixed(1)}%)`);
      
      // 如果匹配率不是100%，输出未匹配的锚点
      if (ranges.length < meaningBlocks.length) {
        const matchedIds = new Set(ranges.map(r => r.meaningBlock.id));
        const unmatchedBlocks = meaningBlocks.filter(block => !matchedIds.has(block.id));
        console.log(`❌ 未匹配的锚点 (${unmatchedBlocks.length}个):`);
        unmatchedBlocks.forEach((block, index) => {
          const searchText = block.original_word_form || block.anchor_text;
          console.log(`  ${index + 1}. "${searchText}" (${block.chinese_meaning})`);
          console.log(`     锚点文本: "${block.anchor_text}"`);
          console.log(`     原文形式: "${block.original_word_form || '未设置'}"`);
          console.log(`     使用文本: "${searchText}"`);
          console.log(`     位置: ${block.start_position}-${block.end_position}`);
          console.log(`     类型: ${block.anchor_type}`);
          
          if (expandedData?.expandedContent) {
            // 检查在展开内容中是否能找到这个文本
            const searchText = block.original_word_form || block.anchor_text;
            const foundIndex = expandedData.expandedContent.indexOf(searchText);
            const foundIndexInsensitive = expandedData.expandedContent.toLowerCase().indexOf(searchText.toLowerCase());
            console.log(`     在展开内容中查找: ${foundIndex !== -1 ? `找到位置${foundIndex}` : '未找到'}`);
            console.log(`     大小写不敏感查找: ${foundIndexInsensitive !== -1 ? `找到位置${foundIndexInsensitive}` : '未找到'}`);
            
            if (foundIndexInsensitive !== -1 && foundIndex === -1) {
              const actualText = expandedData.expandedContent.substring(foundIndexInsensitive, foundIndexInsensitive + searchText.length);
              console.log(`     实际匹配文本: "${actualText}" (大小写不同)`);
            }
            
            // 显示原始内容中对应位置的文本
            if (block.start_position != null && block.end_position != null) {
              const originalText = content.slice(block.start_position, block.end_position);
              console.log(`     原始位置文本: "${originalText}"`);
              
              // 显示展开内容的前100个字符，帮助理解内容结构
              console.log(`     展开内容前100字符: "${expandedData.expandedContent.substring(0, 100)}..."`);
              
              // 尝试查找包含此位置的句子
              const containingSentence = expandedData.sentencePositions.find(pos => 
                block.start_position! >= pos.startInOriginal && block.start_position! < pos.endInOriginal
              );
              if (containingSentence) {
                console.log(`     所属句子: ${containingSentence.sentenceId}`);
                console.log(`     句子原始位置: ${containingSentence.startInOriginal}-${containingSentence.endInOriginal}`);
                console.log(`     句子展开位置: ${containingSentence.startInExpanded}-${containingSentence.endInExpanded}`);
                
                // 显示句子内容
                const sentenceContent = expandedData.expandedContent.substring(
                  containingSentence.startInExpanded, 
                  containingSentence.endInExpanded
                );
                console.log(`     句子内容: "${sentenceContent}"`);
                
                // 计算映射后的位置
                const relativeStart = block.start_position! - containingSentence.startInOriginal;
                const relativeEnd = block.end_position! - containingSentence.startInOriginal;
                const mappedStart = containingSentence.startInExpanded + relativeStart;
                const mappedEnd = containingSentence.startInExpanded + relativeEnd;
                console.log(`     映射后位置: ${mappedStart}-${mappedEnd}`);
                
                if (mappedStart >= 0 && mappedEnd <= expandedData.expandedContent.length) {
                  const mappedText = expandedData.expandedContent.substring(mappedStart, mappedEnd);
                  console.log(`     映射后文本: "${mappedText}"`);
                }
              } else {
                console.log(`     ⚠️ 未找到包含此位置的句子`);
              }
            }
          }
        });
      }
    }
    
    return ranges.sort((a, b) => a.start - b.start);
  }, [content, meaningBlocks, expandedData]);

  // 获取短语边框信息
  const getPhraseRanges = useMemo(() => {
    if (!expandedData) return [];
    
    const phraseRanges: Array<{
      anchorRange: AnchorRange;
      wordKeys: string[];
    }> = [];

    anchorRanges.forEach(anchorRange => {
      const wordsInAnchor: string[] = [];
      
      // 找到这个锚点涉及的所有单词
      expandedData.sentencePositions.forEach((sentencePos) => {
        const sentence = embeddedSentences.get(sentencePos.sentenceId);
        if (!sentence || !sentence.words) return;
        
        sentence.words.forEach((word: any, wordIndex: number) => {
          const wordContent = word.content || word.word;
          if (!wordContent) return;
          
          const sentenceText = sentence.content || sentence.text_content;
          const wordPositionInSentence = sentenceText.indexOf(wordContent);
          if (wordPositionInSentence === -1) return;
          
          const wordStartInExpanded = sentencePos.startInExpanded + wordPositionInSentence;
          const wordEndInExpanded = wordStartInExpanded + wordContent.length;
          
          // 检查单词是否在锚点范围内
          if (anchorRange.start <= wordStartInExpanded && anchorRange.end >= wordEndInExpanded) {
            const wordKey = `${sentence.id || sentencePos.sentenceId}-${word.id || wordIndex}`;
            wordsInAnchor.push(wordKey);
          }
        });
      });

      if (wordsInAnchor.length > 1) {
        phraseRanges.push({ anchorRange, wordKeys: wordsInAnchor });
      }
    });

    return phraseRanges;
  }, [anchorRanges, embeddedSentences, expandedData]);

  // 防抖更新短语边框
  const debouncedUpdatePhraseBorders = useCallback(() => {
    if (updateBordersTimeoutRef.current) {
      clearTimeout(updateBordersTimeoutRef.current);
    }

    updateBordersTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current || !containerRef.current) return;

      const borders: React.ReactNode[] = [];
      
      getPhraseRanges.forEach((phraseRange, rangeIndex) => {
        const wordElements: HTMLElement[] = [];
        
        phraseRange.wordKeys.forEach(wordKey => {
          const element = wordRefs.current.get(wordKey);
          if (element) {
            wordElements.push(element);
          }
        });
        
        if (wordElements.length === 0) return;
        
        const containerRect = containerRef.current!.getBoundingClientRect();
        
        // 快速计算边框位置
        const rects = wordElements.map(element => element.getBoundingClientRect());
        
        // 按行分组单词
        const lineGroups: Array<Array<DOMRect>> = [];
        let currentLine: Array<DOMRect> = [];
        let currentTop = rects[0]?.top || 0;
        
        rects.forEach(rect => {
          if (Math.abs(rect.top - currentTop) > 10) {
            if (currentLine.length > 0) {
              lineGroups.push(currentLine);
            }
            currentLine = [rect];
            currentTop = rect.top;
          } else {
            currentLine.push(rect);
          }
        });
        
        if (currentLine.length > 0) {
          lineGroups.push(currentLine);
        }
        
        // 立即渲染边框
        lineGroups.forEach((lineRects, lineIndex) => {
          const firstRect = lineRects[0];
          const lastRect = lineRects[lineRects.length - 1];
          
          const left = firstRect.left - containerRect.left - 4;
          const width = lastRect.right - firstRect.left + 8;
          const top = firstRect.top - containerRect.top - 4;
          const height = firstRect.height + 8;
          
          borders.push(
            <div
              key={`phrase-border-${phraseRange.anchorRange.meaningBlock.id}-${rangeIndex}-line-${lineIndex}-${stableKey}`}
              className="absolute border-2 rounded-md pointer-events-none z-10 animate-in fade-in duration-150"
              style={{
                left: `${left}px`,
                width: `${width}px`,
                top: `${top}px`,
                height: `${height}px`,
                borderImage: 'linear-gradient(to right, rgb(99 102 241), rgb(168 85 247)) 1',
              }}
            />
          );
        });
      });

      if (isMountedRef.current) {
        setPhraseBorders(borders);
      }
    }, 100); // 增加防抖延迟
  }, [getPhraseRanges, stableKey]);

  // 使用useLayoutEffect确保在DOM更新后计算边框
  useLayoutEffect(() => {
    debouncedUpdatePhraseBorders();
  }, [debouncedUpdatePhraseBorders]);

  // 渲染嵌入式句子内容
  const renderEmbeddedContent = () => {
    if (!content || content.trim() === '') {
      return <span></span>;
    }
    
    if (!content.includes('[[')) {
      return <span>{content}</span>;
    }
    
    const segments = [];
    let lastIndex = 0;
    let segmentIndex = 0;
    
    const pattern = /\[\[([a-f0-9-]+)\]\]/g;
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      // 添加句子前的文本
      if (match.index > lastIndex) {
        const beforeText = content.substring(lastIndex, match.index);
        segments.push(
          <span key={`text-${segmentIndex}`} className="text-muted-foreground">
            {beforeText}
          </span>
        );
        segmentIndex++;
      }
      
      const sentenceId = match[1];
      const sentence = embeddedSentences.get(sentenceId);
      
      if (sentence) {
        const sentenceIndex = segmentIndex;
        segments.push(
          <span 
            key={`sentence-${sentenceId}`}
            className={cn(
              "sentence-inline relative rounded-sm px-0.5 mx-0.5 transition-colors cursor-pointer",
              activeIndex === sentenceIndex 
                ? "text-emerald-500 font-medium"
                : "hover:bg-accent/10 group"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSentenceClick(sentence, sentenceIndex);
            }}
          >
            {/* 播放图标 */}
            <span className={cn(
              "inline-flex items-center justify-center w-3 h-3 mr-0.5 align-text-bottom rounded-full",
              activeIndex === sentenceIndex && isPlaying
                ? "bg-emerald-100" 
                : "bg-transparent group-hover:bg-accent/5"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSentenceClick(sentence, sentenceIndex);
            }}
            >
              {activeIndex === sentenceIndex && isPlaying ? (
                <Pause className="w-2 h-2 text-emerald-600" />
              ) : (
                <Play className="w-2 h-2 text-muted-foreground opacity-50 group-hover:opacity-100" />
              )}
            </span>
            
            {renderSentenceWithWords(sentence, sentenceIndex)}
          </span>
        );
      } else {
        segments.push(
          <span key={`loading-${sentenceId}`} className="px-1 text-muted-foreground italic">
            [加载中...]
          </span>
        );
      }
      
      segmentIndex++;
      lastIndex = match.index + match[0].length;
    }
    
    // 添加最后一段文本
    if (lastIndex < content.length) {
      const finalText = content.substring(lastIndex);
      segments.push(
        <span key={`text-final`} className="text-muted-foreground">
          {finalText}
        </span>
      );
    }
    
    return <span>{segments}</span>;
  };

  // 渲染句子内的单词
  const renderSentenceWithWords = (sentence: any, sentenceIndex: number) => {
    const sentenceText = sentence.content || sentence.text_content;
    
    if (!sentenceText || !sentence.words || sentence.words.length === 0) {
      return <span>{sentenceText || sentence.content || '内容为空'}</span>;
    }

    const sortedWords = [...sentence.words].sort((a, b) => a.begin_time - b.begin_time);
    const elements: React.ReactNode[] = [];
    let lastPosition = 0;
    const originalText = sentenceText;
    const isActiveSentence = activeIndex === sentenceIndex;
    
    // 找到当前句子在展开内容中的位置
    const currentSentencePosition = expandedData?.sentencePositions?.find((pos) => 
      embeddedSentences.get(pos.sentenceId) === sentence
    );
    
    let renderedAnchorCount = 0;
    
    sortedWords.forEach((word, idx) => {
      const wordContent = word.content || word.word;
      if (!wordContent) return;
      
      const wordPosition = originalText.indexOf(wordContent, lastPosition);
      
      if (wordPosition >= 0) {
        // 添加单词前的文本
        if (wordPosition > lastPosition) {
          const gapText = originalText.substring(lastPosition, wordPosition);
          elements.push(
            <span key={`gap-${sentenceIndex}-${idx}`} className="text-muted-foreground">
              {gapText}
            </span>
          );
        }
        
        // 判断单词是否高亮
        const isWordActive = (word: any) => {
          if (activeWordId === word.id) {
            return true;
          }
          return isActiveSentence &&
            currentAudioTime >= word.begin_time &&
            currentAudioTime < word.end_time;
        };
        
        const isWordActiveResult = isWordActive(word);
        
        // 使用位置信息精确匹配锚点
        let anchorRange = null;
        if (expandedData && currentSentencePosition) {
          // 计算单词在展开内容中的绝对位置
          const wordStartInSentence = wordPosition;
          const wordEndInSentence = wordPosition + wordContent.length;
          const wordStartInExpanded = currentSentencePosition.startInExpanded + wordStartInSentence;
          const wordEndInExpanded = currentSentencePosition.startInExpanded + wordEndInSentence;
          
          // 检查是否有锚点完全包含这个单词位置
          anchorRange = anchorRanges.find(range => {
            const anchorFullyContainsWord = range.start <= wordStartInExpanded && range.end >= wordEndInExpanded;
            const hasOverlap = !(range.end <= wordStartInExpanded || range.start >= wordEndInExpanded);
            
            // 精确匹配：锚点完全包含单词，或者有重叠且文本匹配
            if (anchorFullyContainsWord) {
              return true;
            }
            
            // 对于短语，检查是否是部分匹配
            if (hasOverlap && range.text.includes(wordContent)) {
              const anchorText = expandedData.expandedContent.substring(range.start, range.end);
              return anchorText.includes(wordContent);
            }
            
            return false;
          });
          
          if (anchorRange) {
            renderedAnchorCount++;
          }
        }
        
        // 添加单词 - 融合音频高亮和锚点高亮
        const wordKey = `${sentence.id || sentenceIndex}-${word.id || idx}`;
        
        elements.push(
          <span 
            key={`word-${sentenceIndex}-${word.id}`}
            ref={(el) => {
              if (el) {
                wordRefs.current.set(wordKey, el);
                // 防抖触发边框更新，只有当词数变化时才触发
                if (wordRefs.current.size % 20 === 0) { // 减少触发频率
                  debouncedUpdatePhraseBorders();
                }
              } else {
                wordRefs.current.delete(wordKey);
              }
            }}
            className={cn(
              "cursor-pointer px-0.5 relative transition-all duration-200",
              anchorRange && "rounded-sm"
            )}
            onClick={(e) => {
              onWordClick(word, sentenceIndex, e);
            }}
            onMouseEnter={anchorRange ? (e) => handleAnchorHover(anchorRange, e.currentTarget) : undefined}
            onMouseLeave={anchorRange ? handleAnchorLeave : undefined}
          >
            {/* 音频播放高亮动画 - 优先级最高，使用原有样式 */}
            {isWordActiveResult && (
              <motion.span
                className="absolute inset-0 rounded-sm word-highlight-flowing"
                layoutId="word-highlight-flowing"
              />
            )}
            
            {/* 锚点背景 - 在音频高亮下方，只对单词锚点显示 */}
            {anchorRange && !isWordActiveResult && getPhraseRanges.find(pr => pr.wordKeys.includes(wordKey)) === undefined && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-sm opacity-90" />
            )}
            
            {/* 锚点光晕效果 - 只对单词锚点显示 */}
            {anchorRange && getPhraseRanges.find(pr => pr.wordKeys.includes(wordKey)) === undefined && (
              <div className="absolute -inset-px bg-gradient-to-r from-blue-400 to-purple-400 rounded blur-sm -z-10 opacity-30" />
            )}
            
            {/* 文字内容 */}
            <span className={cn(
              "relative z-10 transition-colors",
              isWordActiveResult 
                ? "text-amber-500 font-medium" // 音频播放时的样式
                : anchorRange 
                  ? "text-white font-medium" // 锚点样式
                  : "hover:text-amber-400" // 普通悬停样式
            )}>
              {wordContent}
            </span>
          </span>
        );
        
        lastPosition = wordPosition + wordContent.length;
      }
    });
    
    // 添加最后的文本
    if (lastPosition < originalText.length) {
      elements.push(
        <span key={`final-gap-${sentenceIndex}`} className="text-muted-foreground">
          {originalText.substring(lastPosition)}
        </span>
      );
    }

    return <span>{elements}</span>;
  };

  // 计算悬浮窗口位置
  const calculateTooltipPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.bottom + 8,
      left: rect.left + (rect.width / 2) - 60
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

  const handleAnchorLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      setTooltip(null);
    }, 200);
  };

  const handleTooltipHover = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const expandTooltip = () => {
    if (tooltip) {
      setTooltip({ ...tooltip, isExpanded: true });
    }
  };

  const closeTooltip = () => {
    setTooltip(null);
  };

  // 清理工作
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (updateBordersTimeoutRef.current) {
        clearTimeout(updateBordersTimeoutRef.current);
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      wordRefs.current.clear();
      setTooltip(null);
    };
  }, []);

  return (
    <div className={cn("text-sm leading-relaxed whitespace-pre-wrap relative", className)} ref={containerRef}>
      {/* 短语边框 */}
      {phraseBorders}
      
      {/* 主要内容 */}
      {renderEmbeddedContent()}
      
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
            audioContext={isPlaying ? 'playing' : 'idle'}
          />
        </div>
      )}
    </div>
  );
} 