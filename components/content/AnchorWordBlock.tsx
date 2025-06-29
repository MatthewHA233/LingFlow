import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Type, Layers3, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type MeaningBlockFormatted } from '@/lib/services/meaning-blocks-service';

interface AnchorWordBlockProps {
  content: string;
  blockId: string;
  onSelectedWordsChange: (words: SelectedWord[]) => void;
  onExit: () => void;
  initialSelectedWords?: SelectedWord[];
  existingMeaningBlocks?: MeaningBlockFormatted[];
}

export interface SelectedWord {
  id: string;
  text: string;
  type: 'word' | 'phrase';
  startIndex: number;
  endIndex: number;
  content: string; // 选中的文本内容（单词或短语的实际文本）
  isExisting?: boolean;
  meaningBlock?: MeaningBlockFormatted; // 完整的含义块信息（仅当 isExisting 为 true 时存在）
}

// 新增短语选择接口
interface SelectedPhrase {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  content: string; // 改为content
  segmentIds: string[]; // 包含的segment ID列表
}

type SelectionMode = 'word' | 'phrase';

// 中文分词简化版本
const segmentChinese = (text: string): Array<{text: string, start: number, end: number}> => {
  const segments: Array<{text: string, start: number, end: number}> = [];
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    
    // 跳过空白字符
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    
    // 处理英文单词
    if (/[a-zA-Z]/.test(char)) {
      const wordStart = i;
      while (i < text.length && /[a-zA-Z]/.test(text[i])) {
        i++;
      }
      segments.push({
        text: text.slice(wordStart, i),
        start: wordStart,
        end: i
      });
      continue;
    }
    
    // 处理数字
    if (/[0-9]/.test(char)) {
      const numStart = i;
      while (i < text.length && /[0-9.]/.test(text[i])) {
        i++;
      }
      segments.push({
        text: text.slice(numStart, i),
        start: numStart,
        end: i
      });
      continue;
    }
    
    // 处理标点符号
    if (/[，。！？；：""''（）【】《》、]/.test(char)) {
      segments.push({
        text: char,
        start: i,
        end: i + 1
      });
      i++;
      continue;
    }
    
    // 中文字符，每个字作为一个单元
    if (/[\u4e00-\u9fff]/.test(char)) {
      segments.push({
        text: char,
        start: i,
        end: i + 1
      });
      i++;
      continue;
    }
    
    // 其他字符
    segments.push({
      text: char,
      start: i,
      end: i + 1
    });
    i++;
  }
  
  return segments.filter(seg => seg.text.trim().length > 0);
};

export function AnchorWordBlock({ 
  content, 
  blockId, 
  onSelectedWordsChange, 
  onExit,
  initialSelectedWords = [],
  existingMeaningBlocks = []
}: AnchorWordBlockProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('word');
  const [selectedWords, setSelectedWords] = useState<SelectedWord[]>(initialSelectedWords);
  
  // 短语模式独立状态
  const [selectedPhrases, setSelectedPhrases] = useState<SelectedPhrase[]>([]);
  const [phraseIsMouseDown, setPhraseIsMouseDown] = useState(false);
  const [phraseIsDragging, setPhraseIsDragging] = useState(false);
  const [phraseCurrentHoveredSegment, setPhraseCurrentHoveredSegment] = useState<{text: string, start: number, end: number} | null>(null);
  const [phraseMouseDownPosition, setPhraseMouseDownPosition] = useState<{x: number, y: number} | null>(null);
  
  // 单词模式状态
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentHoveredSegment, setCurrentHoveredSegment] = useState<{text: string, start: number, end: number} | null>(null);
  const [mouseDownPosition, setMouseDownPosition] = useState<{x: number, y: number} | null>(null);

  // 容器ref用于计算短语边框位置
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // 分词处理
  const wordSegments = useMemo(() => segmentChinese(content), [content]);

  // 当前模式下的segments
  const currentSegments = wordSegments;

  // 监听外部传入的 selectedWords 变化，同步更新内部状态
  useEffect(() => {
    // 从 initialSelectedWords 中分离单词和短语
    const words = initialSelectedWords.filter(w => w.type === 'word');
    const phrases = initialSelectedWords.filter(w => w.type === 'phrase');
    
    setSelectedWords(words);
    
    // 将短语转换为内部的 SelectedPhrase 格式
    const convertedPhrases: SelectedPhrase[] = phrases.map(phrase => {
      // 根据短语的位置信息，找到对应的 segments
      const phraseSegments = wordSegments.filter(seg => 
        seg.start >= phrase.startIndex && seg.end <= phrase.endIndex
      );
      
      const segmentIds = phraseSegments.map(seg => `${seg.start}-${seg.end}`);
      
      return {
        id: phrase.id,
        text: phrase.text,
        startIndex: phrase.startIndex,
        endIndex: phrase.endIndex,
        content: phrase.content,
        segmentIds
      };
    });
    
    setSelectedPhrases(convertedPhrases);
  }, [initialSelectedWords, wordSegments]);

  // 处理已有含义块的范围
  const existingAnchorRanges = useMemo(() => {
    return existingMeaningBlocks.map(mb => ({
      start: mb.start_position || 0,
      end: mb.end_position || mb.anchor_text.length,
      meaningBlock: mb,
      text: mb.original_word_form || mb.anchor_text, // 优先使用原文单词形式
      displayText: mb.original_word_form || mb.anchor_text
    })).sort((a, b) => a.start - b.start);
  }, [existingMeaningBlocks]);

  // 添加强制重新渲染的key，基于existingMeaningBlocks的内容
  const renderKey = useMemo(() => {
    return existingMeaningBlocks.map(mb => `${mb.id}-${mb.updated_at || mb.created_at}`).join('-');
  }, [existingMeaningBlocks]);

  // 检查segment是否在已有锚点范围内
  const getExistingAnchorInfo = useCallback((segment: {text: string, start: number, end: number}) => {
    for (const range of existingAnchorRanges) {
      if (segment.start >= range.start && segment.end <= range.end) {
        const segmentsInRange = wordSegments.filter(seg => 
          seg.start >= range.start && seg.end <= range.end &&
          !/[，。！？；：""''（）【】《》、\s]/.test(seg.text)
        );
        
        return {
          isInExistingAnchor: true,
          anchorRange: range,
          isPhrase: segmentsInRange.length > 1
        };
      }
    }
    return { isInExistingAnchor: false, anchorRange: null, isPhrase: false };
  }, [existingAnchorRanges, wordSegments]);

  // 获取已有锚点的短语边框信息
  const getExistingPhraseRanges = useMemo(() => {
    const phraseRanges: Array<{
      anchorRange: any;
      segmentIndices: number[];
    }> = [];

    existingAnchorRanges.forEach(anchorRange => {
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
  }, [existingAnchorRanges, wordSegments]);

  // 单词模式：切换单个词的选择状态
  const toggleWordSelection = useCallback((segment: {text: string, start: number, end: number}) => {
    const wordId = `${blockId}-${segment.start}-${segment.end}`;
    
    setSelectedWords(prevWords => {
      const existingIndex = prevWords.findIndex(w => w.id === wordId);
      
      let newWords;
      if (existingIndex >= 0) {
        // 取消选择
        newWords = prevWords.filter((_, index) => index !== existingIndex);
      } else {
        // 添加选择
        const newWord: SelectedWord = {
          id: wordId,
          text: segment.text,
          type: 'word',
          startIndex: segment.start,
          endIndex: segment.end,
          content: segment.text
        };
        newWords = [...prevWords, newWord];
      }
      
      // 合并单词和短语选择结果传递给父组件
      const phraseWords: SelectedWord[] = selectedPhrases.map(phrase => ({
        id: phrase.id,
        text: phrase.text,
        type: 'phrase' as const,
        startIndex: phrase.startIndex,
        endIndex: phrase.endIndex,
        content: phrase.content
      }));
      
      const allSelected = [...newWords, ...phraseWords];
      onSelectedWordsChange(allSelected);
      return newWords;
    });
  }, [blockId, onSelectedWordsChange, selectedPhrases]);

  // 短语模式：切换单个词的选择状态
  const togglePhraseSelection = useCallback((segment: {text: string, start: number, end: number}) => {
    const segmentId = `${segment.start}-${segment.end}`;
    
    setSelectedPhrases(prevPhrases => {
      // 检查当前segment是否已经在某个短语中
      const existingPhraseIndex = prevPhrases.findIndex(phrase => 
        phrase.segmentIds.includes(segmentId)
      );
      
      let newPhrases;
      if (existingPhraseIndex >= 0) {
        // 从现有短语中移除这个segment
        const existingPhrase = prevPhrases[existingPhraseIndex];
        const newSegmentIds = existingPhrase.segmentIds.filter(id => id !== segmentId);
        
        if (newSegmentIds.length === 0) {
          // 如果短语为空，删除整个短语
          newPhrases = prevPhrases.filter((_, index) => index !== existingPhraseIndex);
        } else {
          // 更新短语
          const newSegments = newSegmentIds.map(id => {
            const [start, end] = id.split('-').map(Number);
            return wordSegments.find(seg => seg.start === start && seg.end === end);
          }).filter(Boolean);
          
          const minStart = Math.min(...newSegments.map(seg => seg!.start));
          const maxEnd = Math.max(...newSegments.map(seg => seg!.end));
          const newText = content.slice(minStart, maxEnd);
          
          const updatedPhrase: SelectedPhrase = {
            ...existingPhrase,
            text: newText,
            startIndex: minStart,
            endIndex: maxEnd,
            segmentIds: newSegmentIds,
            content: newText
          };
          
          newPhrases = prevPhrases.map((phrase, index) => 
            index === existingPhraseIndex ? updatedPhrase : phrase
          );
        }
      } else {
        // 创建新短语或扩展相邻短语
        const adjacentPhrases = prevPhrases.filter(phrase => {
          const phraseSegments = phrase.segmentIds.map(id => {
            const [start, end] = id.split('-').map(Number);
            return { start, end };
          });
          
          // 检查是否相邻
          return phraseSegments.some(seg => 
            Math.abs(seg.end - segment.start) <= 1 || 
            Math.abs(segment.end - seg.start) <= 1
          );
        });
        
        if (adjacentPhrases.length > 0) {
          // 扩展第一个相邻短语
          const targetPhrase = adjacentPhrases[0];
          const newSegmentIds = [...targetPhrase.segmentIds, segmentId];
          
          const newSegments = newSegmentIds.map(id => {
            const [start, end] = id.split('-').map(Number);
            return wordSegments.find(seg => seg.start === start && seg.end === end);
          }).filter(Boolean);
          
          const minStart = Math.min(...newSegments.map(seg => seg!.start));
          const maxEnd = Math.max(...newSegments.map(seg => seg!.end));
          const newText = content.slice(minStart, maxEnd);
          
          const expandedPhrase: SelectedPhrase = {
            ...targetPhrase,
            text: newText,
            startIndex: minStart,
            endIndex: maxEnd,
            segmentIds: newSegmentIds,
            content: newText
          };
          
          newPhrases = prevPhrases.map(phrase => 
            phrase.id === targetPhrase.id ? expandedPhrase : phrase
          );
        } else {
          // 创建新短语
          const phraseId = `${blockId}-phrase-${segment.start}-${segment.end}`;
          const newPhrase: SelectedPhrase = {
            id: phraseId,
            text: segment.text,
            startIndex: segment.start,
            endIndex: segment.end,
            segmentIds: [segmentId],
            content: segment.text
          };
          newPhrases = [...prevPhrases, newPhrase];
        }
      }
      
      // 合并单词和短语选择结果传递给父组件
      const phraseWords: SelectedWord[] = newPhrases.map(phrase => ({
        id: phrase.id,
        text: phrase.text,
        type: 'phrase' as const,
        startIndex: phrase.startIndex,
        endIndex: phrase.endIndex,
        content: phrase.content
      }));
      
      const allSelected = [...selectedWords, ...phraseWords];
      onSelectedWordsChange(allSelected);
      return newPhrases;
    });
  }, [blockId, onSelectedWordsChange, wordSegments, content, selectedWords]);

  // 处理单击选择
  const handleSegmentClick = useCallback((segment: {text: string, start: number, end: number}) => {
    if (selectionMode === 'phrase') {
      // 短语模式下如果刚刚拖拽过，不处理单击
      if (phraseIsDragging) {
        console.log('Phrase click ignored due to dragging');
        return;
      }
      console.log('Phrase clicked on:', segment.text);
      togglePhraseSelection(segment);
    } else {
      // 单词模式下禁用短语选择，只处理单词选择
      if (isDragging) {
        console.log('Word click ignored due to dragging');
        return;
      }
      console.log('Word clicked on:', segment.text);
      toggleWordSelection(segment);
    }
  }, [selectionMode, isDragging, phraseIsDragging, toggleWordSelection, togglePhraseSelection]);

  // 处理容器上的鼠标按下
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (selectionMode === 'phrase') {
      setPhraseIsMouseDown(true);
      setPhraseIsDragging(false);
      setPhraseCurrentHoveredSegment(null);
      setPhraseMouseDownPosition({ x: e.clientX, y: e.clientY });
      console.log('Phrase container mouse down');
    } else {
      // 单词模式下只处理单词拖拽
      setIsMouseDown(true);
      setIsDragging(false);
      setCurrentHoveredSegment(null);
      setMouseDownPosition({ x: e.clientX, y: e.clientY });
      console.log('Word container mouse down');
    }
  }, [selectionMode]);

  // 处理容器上的鼠标移动
  const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
    if (selectionMode === 'phrase') {
      if (phraseIsMouseDown) {
        // 检查是否移动了足够距离来判定为拖拽
        if (!phraseIsDragging && phraseMouseDownPosition) {
          const distance = Math.sqrt(
            Math.pow(e.clientX - phraseMouseDownPosition.x, 2) + 
            Math.pow(e.clientY - phraseMouseDownPosition.y, 2)
          );
          
          if (distance > 5) {
            setPhraseIsDragging(true);
            console.log('Started phrase dragging');
          }
        }
        
        // 只有在拖拽状态下才处理词的切换
        if (phraseIsDragging) {
          const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
          
          if (elementUnderMouse) {
            let wordSpan = elementUnderMouse.closest('[data-word-segment]') as HTMLElement;
            
            if (wordSpan) {
              const segmentData = wordSpan.getAttribute('data-word-segment');
              if (segmentData) {
                try {
                  const segment = JSON.parse(segmentData);
                  
                  if (!phraseCurrentHoveredSegment || 
                      phraseCurrentHoveredSegment.start !== segment.start || 
                      phraseCurrentHoveredSegment.end !== segment.end) {
                    console.log('Entering new phrase segment:', segment.text);
                    setPhraseCurrentHoveredSegment(segment);
                    togglePhraseSelection(segment);
                  }
                } catch (e) {
                  console.error('Failed to parse phrase segment data:', e);
                }
              }
            } else {
              setPhraseCurrentHoveredSegment(null);
            }
          }
        }
      }
    } else {
      // 单词模式下只处理单词拖拽逻辑
      if (isMouseDown) {
        if (!isDragging && mouseDownPosition) {
          const distance = Math.sqrt(
            Math.pow(e.clientX - mouseDownPosition.x, 2) + 
            Math.pow(e.clientY - mouseDownPosition.y, 2)
          );
          
          if (distance > 5) {
            setIsDragging(true);
            console.log('Started word dragging');
          }
        }
        
        if (isDragging) {
          const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
          
          if (elementUnderMouse) {
            let wordSpan = elementUnderMouse.closest('[data-word-segment]') as HTMLElement;
            
            if (wordSpan) {
              const segmentData = wordSpan.getAttribute('data-word-segment');
              if (segmentData) {
                try {
                  const segment = JSON.parse(segmentData);
                  
                  if (!currentHoveredSegment || 
                      currentHoveredSegment.start !== segment.start || 
                      currentHoveredSegment.end !== segment.end) {
                    console.log('Entering new word segment:', segment.text);
                    setCurrentHoveredSegment(segment);
                    toggleWordSelection(segment);
                  }
                } catch (e) {
                  console.error('Failed to parse word segment data:', e);
                }
              }
            } else {
              setCurrentHoveredSegment(null);
            }
          }
        }
      }
    }
  }, [selectionMode, phraseIsMouseDown, phraseIsDragging, phraseMouseDownPosition, phraseCurrentHoveredSegment, togglePhraseSelection, isMouseDown, isDragging, mouseDownPosition, currentHoveredSegment, toggleWordSelection]);

  // 处理容器上的鼠标抬起
  const handleContainerMouseUp = useCallback(() => {
    if (selectionMode === 'phrase') {
      console.log('Phrase container mouse up, was dragging:', phraseIsDragging);
      setPhraseIsMouseDown(false);
      setPhraseCurrentHoveredSegment(null);
      setPhraseMouseDownPosition(null);
      
      setTimeout(() => {
        setPhraseIsDragging(false);
      }, 50);
    } else {
      // 单词模式下只处理单词拖拽结束
      console.log('Word container mouse up, was dragging:', isDragging);
      setIsMouseDown(false);
      setCurrentHoveredSegment(null);
      setMouseDownPosition(null);
      
      setTimeout(() => {
        setIsDragging(false);
      }, 50);
    }
  }, [selectionMode, phraseIsDragging, isDragging]);

  // 全局鼠标抬起监听
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false);
      setPhraseIsMouseDown(false);
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // 当短语选择变化时，强制重新渲染以更新边框位置
  const [forceUpdate, setForceUpdate] = useState(0);
  
  useEffect(() => {
    // 延迟一帧确保DOM已更新
    requestAnimationFrame(() => {
      setForceUpdate(prev => prev + 1);
    });
  }, [selectedPhrases, existingMeaningBlocks]); // 同时监听已有含义块的变化

  // 检查segment是否在单词模式下被选中
  const isSegmentSelectedAsWord = useCallback((segment: {text: string, start: number, end: number}) => {
    const wordId = `${blockId}-${segment.start}-${segment.end}`;
    return selectedWords.some(w => w.id === wordId);
  }, [selectedWords, blockId]);

  // 检查segment是否在短语模式下被选中
  const isSegmentSelectedAsPhrase = useCallback((segment: {text: string, start: number, end: number}) => {
    const segmentId = `${segment.start}-${segment.end}`;
    return selectedPhrases.some(phrase => phrase.segmentIds.includes(segmentId));
  }, [selectedPhrases]);

  // 获取连续的短语区间
  const getPhraseRanges = useCallback(() => {
    const ranges: Array<{
      phraseId: string;
      startIndex: number;
      endIndex: number;
      segmentIndices: number[];
    }> = [];

    selectedPhrases.forEach(phrase => {
      const segmentIndices: number[] = [];
      
      phrase.segmentIds.forEach(segmentId => {
        const [start, end] = segmentId.split('-').map(Number);
        const segmentIndex = currentSegments.findIndex(seg => seg.start === start && seg.end === end);
        if (segmentIndex !== -1) {
          segmentIndices.push(segmentIndex);
        }
      });

      if (segmentIndices.length > 0) {
        segmentIndices.sort((a, b) => a - b);
        ranges.push({
          phraseId: phrase.id,
          startIndex: Math.min(...segmentIndices),
          endIndex: Math.max(...segmentIndices),
          segmentIndices
        });
      }
    });

    return ranges;
  }, [selectedPhrases, currentSegments]);

  // 强制清理refs和状态当含义块数据变化时
  useEffect(() => {
    // 延迟清理refs，确保当前渲染周期完成
    const timeoutId = setTimeout(() => {
      if (segmentRefs.current.length > 0) {
        console.log('清理segment refs，准备重新渲染');
        // 不直接重置数组，而是标记需要更新
        setForceUpdate(prev => prev + 1);
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [renderKey]);

  // 渲染segments
  const renderSegments = () => {
    const phraseRanges = getPhraseRanges();
    const existingPhraseRanges = getExistingPhraseRanges;
    
    return (
      <div className="relative">
        {/* 渲染新选择的短语边框 */}
        {phraseRanges.map((range, rangeIndex) => {
          // 获取范围内所有segment的位置信息
          const segmentRects: Array<{rect: DOMRect, index: number}> = [];
          
          range.segmentIndices.forEach(segmentIndex => {
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
            // 如果Y坐标差异超过一定阈值，认为是新行
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
              <motion.div
                key={`phrase-border-${range.phraseId}-line-${lineIndex}-${forceUpdate}`}
                className="absolute border-2 rounded-md pointer-events-none"
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  top: `${top}px`,
                  height: `${height}px`,
                  zIndex: 1,
                  borderImage: 'linear-gradient(to right, rgb(99 102 241), rgb(168 85 247)) 1'
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              />
            );
          });
        })}

        {/* 渲染已有的短语边框 */}
        {existingPhraseRanges.map((range: { anchorRange: any; segmentIndices: number[] }, rangeIndex: number) => {
          // 获取范围内所有segment的位置信息
          const segmentRects: Array<{rect: DOMRect, index: number}> = [];
          
          range.segmentIndices.forEach((segmentIndex: number) => {
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
          
          // 为每一行渲染边框 - 使用暗黄色表示已有锚点
          return lineGroups.map((lineSegments, lineIndex) => {
            const firstSegment = lineSegments[0];
            const lastSegment = lineSegments[lineSegments.length - 1];
            
            const left = firstSegment.rect.left - containerRect.left - 4;
            const width = lastSegment.rect.right - firstSegment.rect.left + 8;
            const top = firstSegment.rect.top - containerRect.top - 4;
            const height = firstSegment.rect.height + 8;
            
            return (
              <div
                key={`existing-phrase-border-${range.anchorRange.meaningBlock.id}-${rangeIndex}-line-${lineIndex}-${forceUpdate}`}
                className="absolute border-2 rounded-md pointer-events-none"
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  top: `${top}px`,
                  height: `${height}px`,
                  zIndex: 1,
                  borderImage: 'linear-gradient(to right, rgb(245 158 11), rgb(217 119 6)) 1' // 暗黄色表示已有锚点
                }}
              />
            );
          });
        })}
        
        {/* 渲染文本segments */}
        {currentSegments.map((segment, index) => {
          const isWordSelected = isSegmentSelectedAsWord(segment);
          const isPhraseSelected = isSegmentSelectedAsPhrase(segment);
          const existingInfo = getExistingAnchorInfo(segment);
          const isPunctuation = /[，。！？；：""''（）【】《》、\s]/.test(segment.text);
          
          return (
            <motion.span
              key={`${segment.start}-${segment.end}-${forceUpdate}`}
              ref={(el) => {
                segmentRefs.current[index] = el;
              }}
              className={cn(
                "relative inline-block transition-all duration-200 select-none",
                !isPunctuation && "mx-0.5 px-1 rounded-sm",
                // 已有锚点样式 - 改为暗黄色
                !isPunctuation && existingInfo.isInExistingAnchor && !existingInfo.isPhrase && "bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md cursor-not-allowed",
                !isPunctuation && existingInfo.isInExistingAnchor && existingInfo.isPhrase && "cursor-not-allowed",
                // 新选择的样式
                !isPunctuation && !existingInfo.isInExistingAnchor && !isWordSelected && "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer",
                !isPunctuation && !existingInfo.isInExistingAnchor && isWordSelected && "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md cursor-pointer",
                isPunctuation && "text-muted-foreground"
              )}
              onClick={() => !isPunctuation && handleSegmentClick(segment)}
              data-word-segment={!isPunctuation ? JSON.stringify(segment) : undefined}
              whileHover={!isPunctuation && !existingInfo.isInExistingAnchor ? { scale: 1.05 } : {}}
              whileTap={!isPunctuation && !existingInfo.isInExistingAnchor ? { scale: 0.95 } : {}}
              layout
            >
              {segment.text}
              
              {/* 新选择的单词模式选中效果 */}
              {isWordSelected && !existingInfo.isInExistingAnchor && (
                <motion.div
                  className="absolute -inset-px bg-gradient-to-r from-blue-400 to-purple-400 rounded blur-sm -z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.3 }}
                  exit={{ opacity: 0 }}
                />
              )}

              {/* 已有锚点的光晕效果 - 使用暗黄色 */}
              {existingInfo.isInExistingAnchor && !existingInfo.isPhrase && (
                <div className="absolute -inset-px bg-gradient-to-r from-amber-400 to-yellow-400 rounded blur-sm -z-10 opacity-30" />
              )}
            </motion.span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-3 border-2 border-dashed border-blue-300 dark:border-blue-700">
      {/* 头部控制栏 */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full transition-colors"
            title="退出锚定模式"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
          
          <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
            锚定词块模式
          </div>
        </div>
        
        {/* 选择模式切换 */}
        <ToggleGroup 
          type="single" 
          value={selectionMode} 
          onValueChange={(value) => value && setSelectionMode(value as SelectionMode)}
          className="bg-white dark:bg-slate-800 rounded-md p-0.5"
        >
          <ToggleGroupItem 
            value="word" 
            className="data-[state=on]:bg-blue-500 data-[state=on]:text-white h-6 px-2 text-xs"
          >
            <Type className="w-3 h-3 mr-1" />
            单词
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="phrase" 
            className="data-[state=on]:bg-purple-500 data-[state=on]:text-white h-6 px-2 text-xs"
          >
            <Layers3 className="w-3 h-3 mr-1" />
            短语
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* 统计信息 */}
      <div className="mb-2 text-xs text-muted-foreground">
        {selectionMode === 'word' 
          ? `已选择 ${selectedWords.length} 个单词`
          : `已选择 ${selectedPhrases.length} 个短语`
        }
      </div>

      {/* 内容区域 */}
      <div 
        ref={containerRef}
        className="text-base leading-tight space-y-2 user-select-none"
        onMouseDown={handleContainerMouseDown}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={() => {
          setIsMouseDown(false);
          setPhraseIsMouseDown(false);
        }}
      >
        <AnimatePresence mode="popLayout">
          {renderSegments()}
        </AnimatePresence>
      </div>

      {/* 提示文本 */}
      <div className="mt-3 pt-2 border-t border-blue-200 dark:border-blue-800 text-xs text-blue-600 dark:text-blue-400">
        {selectionMode === 'word' 
          ? "点击选择单词，或拖拽进行批量选择" 
          : "点击选择短语，相邻单词会自动吸附组成短语"
        }
      </div>
    </div>
  );
} 