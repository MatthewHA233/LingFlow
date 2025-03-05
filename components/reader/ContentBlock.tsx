import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import { Play, Pause, Loader2, Music2, Globe, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextAlignmentService } from '@/lib/services/text-alignment';
import { supabase } from '@/lib/supabase-client';
import { toast } from '@/hooks/use-toast';
import Image from 'next/image';
import { AudioController, AUDIO_EVENTS } from '@/lib/audio-controller';
import { AnimatePresence, motion } from "framer-motion";

interface ContentBlockProps {
  block: {
    id: string;
    block_type: string;
    content: string;
    metadata?: Record<string, any>;
    order_index: number;
    speech_id?: string;
  };
  resources?: Array<{ original_path: string; oss_path: string }>;
  onBlockUpdate?: (blockId: string, newType: string, content: string) => void;
  onOrderChange?: (draggedId: string, droppedId: string, position: 'before' | 'after') => void;
  isSelected?: boolean;
  onSelect?: (blockId: string, event: React.MouseEvent) => void;
  audioUrl?: string;
  onTimeChange?: (time: number) => void;
  isAligning?: boolean;
  onAlignmentComplete?: (blockId: string) => void;
  playMode?: 'sentence' | 'block' | 'continuous';
  onPlayNext?: (blockId: string, lastSentenceIndex: number) => void;
  onPlayModeChange?: (newMode: 'sentence' | 'block' | 'continuous') => void;
  onShowSplitView?: (blockId: string, type: 'source' | 'translation') => void;
}

// 创建一个自定义事件名称
const CLEAR_ACTIVE_SENTENCE_EVENT = 'clear-active-sentences';

// 添加一个全局活跃块ID事件
const ACTIVE_BLOCK_CHANGED_EVENT = 'active-block-changed';

export function ContentBlock({ 
  block, 
  resources, 
  onBlockUpdate,
  onOrderChange,
  isSelected,
  onSelect,
  audioUrl,
  onTimeChange,
  isAligning = false,
  onAlignmentComplete,
  playMode,
  onPlayNext,
  onPlayModeChange,
  onShowSplitView
}: ContentBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localAligning, setLocalAligning] = useState(isAligning);
  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [embeddedSentences, setEmbeddedSentences] = useState<Map<string, any>>(new Map());
  const [isLoadingSentences, setIsLoadingSentences] = useState(false);
  const [showAlignmentPanel, setShowAlignmentPanel] = useState(false);
  const [showSplitView, setShowSplitView] = useState(false);
  const [sentences, setSentences] = useState<any[]>([]);
  
  const blockRef = useRef<HTMLDivElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  
  // 创建唯一ID用于标识当前块
  const blockId = useId();

  // 添加缺失的ref
  const isClicking = useRef(false);

  // 先定义辅助函数，不依赖其他函数
  const getSentenceIdsFromContent = useCallback(() => {
    const ids: string[] = [];
    const pattern = /\[\[([a-f0-9-]+)\]\]/g;
    let match;
    
    while ((match = pattern.exec(block.content || '')) !== null) {
      ids.push(match[1]);
    }
    
    return ids;
  }, [block.content]);

  // 声明playSentence函数引用，使用useRef解决循环引用问题
  const playSentenceRef = useRef<any>(null);

  // 定义handleSentenceEnd函数，使用ref引用playSentence
  const handleSentenceEnd = useCallback((index: number) => {
    if (!embeddedSentences || embeddedSentences.size === 0) return;
    
    // 提取句子IDs
    const sentenceIds = getSentenceIdsFromContent();
    if (index < 0 || index >= sentenceIds.length) return;
    
    // 判断是否为最后一句
    const isLastSentence = index >= sentenceIds.length - 1;
    
    // 如果是连续播放模式且是最后一句，在转向下一个块前清除当前高亮
    if (playMode === 'continuous' && isLastSentence) {
      console.log(`${block.id}: 最后一句播放完毕，清除高亮并准备下一个块`);
      
      // 先清除当前高亮
      setActiveIndex(null);
      setIsPlaying(false);
      setActiveWordId(null);
      
      // 然后再播放下一个块
      setTimeout(() => {
        onPlayNext?.(block.id, index);
      }, 50);
    } else if (playMode === 'sentence') {
      // 重播当前句子
      const sentenceId = sentenceIds[index];
      const sentence = embeddedSentences.get(sentenceId);
      if (sentence) {
        setTimeout(() => playSentenceRef.current(sentence, index), 300);
      }
    } else if (playMode === 'block' && isLastSentence) {
      // 段落循环 - 回到第一句
      const firstId = sentenceIds[0];
      const firstSentence = embeddedSentences.get(firstId);
      if (firstSentence) {
        setTimeout(() => playSentenceRef.current(firstSentence, 0), 600);
      }
    } else if ((playMode === 'block' || playMode === 'continuous') && !isLastSentence) {
      // 播放下一句
      const nextIndex = index + 1;
      const nextId = sentenceIds[nextIndex];
      const nextSentence = embeddedSentences.get(nextId);
      if (nextSentence) {
        setTimeout(() => playSentenceRef.current(nextSentence, nextIndex), 300);
      }
    }
  }, [embeddedSentences, playMode, getSentenceIdsFromContent, block.id, blockId, onPlayNext]);

  // 完全重写的playSentence函数
  const playSentence = useCallback((sentence: any, index: number) => {
    console.log('播放句子', index, sentence);
    
    // 如果点击当前播放的句子，则停止播放
    if (activeIndex === index && isPlaying) {
      AudioController.stop();
      setIsPlaying(false);
      setActiveIndex(null);
      setActiveWordId(null);
      return;
    }
    
    // 广播当前活跃块ID - 这会通知其他块清除高亮
    window.dispatchEvent(new CustomEvent(ACTIVE_BLOCK_CHANGED_EVENT, {
      detail: { activeBlockId: block.id }
    }));
    
    // 始终先停止所有播放
    AudioController.stop();
    
    // 检查句子数据
    if (!sentence || !audioUrl) {
      console.error('无法播放：句子数据或音频URL缺失', sentence);
      return;
    }
    
    // 获取时间范围
    const beginTime = sentence.begin_time;
    const endTime = sentence.end_time;
    
    if (beginTime === undefined || endTime === undefined) {
      console.error('句子缺少时间信息', sentence);
      return;
    }
    
    console.log(`播放句子 ${index}:`, beginTime, endTime);
    
    // 先设置状态，确保UI立即反应
    setActiveIndex(index);
    setIsPlaying(true);
    
    // 使用AudioController播放
    AudioController.play({
      url: audioUrl,
      startTime: beginTime,
      endTime: endTime,
      context: 'sentence',
      loop: false,
      playerId: `block-${block.id}-sentence-${index}`
    });
    
    // 更新父组件时间
    onTimeChange?.(beginTime);
  }, [activeIndex, isPlaying, audioUrl, block.id, onTimeChange]);

  // 更新引用
  useEffect(() => {
    playSentenceRef.current = playSentence;
  }, [playSentence]);
  
  // 修改音频事件监听，增加范围外检测清除逻辑
  useEffect(() => {
    // 只在浏览器环境中添加事件监听
    if (typeof window === 'undefined') return;
    
    // 监听音频时间更新事件 - 用于句子和单词高亮
    const handleTimeUpdate = (e: CustomEvent) => {
      const { currentTime, playerId, context } = e.detail;
      
      // 添加提前量（500毫秒 = 0.5秒）
      const adjustedTime = currentTime + 0.5;
      
      // 更新当前时间
      setCurrentAudioTime(adjustedTime);
      
      // 如果手动点击状态，不自动切换高亮句子
      if (isClicking.current) return;
      
      // 查找当前时间对应的句子
      const sentenceIds = getSentenceIdsFromContent();
      
      // 没有句子数据，清除高亮
      if (sentenceIds.length === 0 || embeddedSentences.size === 0) {
        if (activeIndex !== null || isPlaying) {
          setActiveIndex(null);
          setIsPlaying(false);
          setActiveWordId(null);
        }
        return;
      }
      
      // 确定当前音频是否在任何句子的时间范围内
      let inAnySentenceRange = false;
      let foundSentence = false;
      
      for (let i = 0; i < sentenceIds.length; i++) {
        const sentenceId = sentenceIds[i];
        const sentence = embeddedSentences.get(sentenceId);
        
        if (!sentence) continue;
        
        // 检查是否在整个块的时间范围内(宽松检查)
        if (adjustedTime >= sentence.begin_time && 
            adjustedTime <= sentence.end_time) {
          inAnySentenceRange = true;
          
          // 找到了当前句子，设置高亮
          if (activeIndex !== i) {
            console.log(`高亮句子 ${i}: ${adjustedTime}秒在范围 ${sentence.begin_time}~${sentence.end_time}`);
            setActiveIndex(i);
            setIsPlaying(true);
          }
          
          foundSentence = true;
          
          // 处理单词高亮
          if (sentence.words && Array.isArray(sentence.words)) {
            let foundWord = false;
            
            for (const word of sentence.words) {
              if (adjustedTime >= word.begin_time && 
                  adjustedTime <= word.end_time) {
                setActiveWordId(word.id);
                foundWord = true;
                break;
              }
            }
            
            if (!foundWord) {
              setActiveWordId(null);
            }
          }
          
          break;
        }
      }
      
      // 清除高亮的关键 - 如果不在任何句子范围内，且不是句子播放上下文
      if (!inAnySentenceRange && context !== 'sentence') {
        if (activeIndex !== null || isPlaying) {
          console.log('音频时间超出语境块句子范围，清除高亮');
      setActiveIndex(null);
          setIsPlaying(false);
          setActiveWordId(null);
        }
      }
      
      // 如果没找到任何句子匹配当前时间，但仍在范围内，保持当前高亮
      // 这解决了句子间空隙的问题
    };
    
    window.addEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    };
  }, [activeIndex, isPlaying, embeddedSentences, getSentenceIdsFromContent]);

  // 2. 然后是其他函数和useEffect，保持原有顺序
  const parseAndLoadEmbeddedSentences = useCallback(async () => {
    // 仅处理音频对齐块或包含[[sentenceId]]格式的文本块
    if (block.block_type === 'audio_aligned' || 
        (block.content && block.content.includes('[['))) {
      
      // 提取所有句子ID
      const sentenceIdMatches = block.content.match(/\[\[([a-f0-9-]+)\]\]/g) || [];
      if (sentenceIdMatches.length === 0) return;
      
      setIsLoadingSentences(true);
      
      try {
        // 从所有匹配中提取纯ID
        const sentenceIds = sentenceIdMatches.map(match => 
          match.replace('[[', '').replace(']]', '')
        );
        
        // 加载所有引用的句子
        const { data: sentences, error } = await supabase
          .from('sentences')
          .select('*, words(*)')
          .in('id', sentenceIds);
        
        if (error) {
          console.error('加载嵌入式句子失败:', error);
          return;
        }
        
        // 创建ID到句子的映射
        const sentencesMap = new Map();
        sentences?.forEach(sentence => {
          sentencesMap.set(sentence.id, sentence);
        });
        
        setEmbeddedSentences(sentencesMap);
      } catch (err) {
        console.error('处理嵌入式句子失败:', err);
      } finally {
        setIsLoadingSentences(false);
      }
    }
  }, [block.block_type, block.content]);

  // 在embeddedSentences变更时更新sentences数组
  useEffect(() => {
    if (embeddedSentences.size > 0) {
      // 从嵌入式句子映射中提取句子数组并按顺序排列
      const extractedSentences: any[] = [];
      const sentenceIdMatches = block.content.match(/\[\[([a-f0-9-]+)\]\]/g) || [];
      
      sentenceIdMatches.forEach(match => {
        const id = match.replace('[[', '').replace(']]', '');
        const sentence = embeddedSentences.get(id);
        if (sentence) {
          extractedSentences.push(sentence);
        }
      });
      
      setSentences(extractedSentences);
    }
  }, [embeddedSentences, block.content]);

  useEffect(() => {
    parseAndLoadEmbeddedSentences();
  }, [parseAndLoadEmbeddedSentences]);

  useEffect(() => {
    setLocalAligning(isAligning);
  }, [isAligning]);

  useEffect(() => {
    if (localAligning) {
      const timer = setTimeout(() => {
        setLocalAligning(false);
        setShowCompleteAnimation(true);
        
        setTimeout(() => {
          setShowCompleteAnimation(false);
          onAlignmentComplete?.(block.id);
          
          parseAndLoadEmbeddedSentences();
        }, 1500);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [localAligning, block.id, onAlignmentComplete, parseAndLoadEmbeddedSentences]);

  // 处理块点击事件
  const handleClick = (e: React.MouseEvent) => {
    if (onSelect && !e.defaultPrevented) {
      onSelect(block.id, e);
    }
  };

  // 内容变更处理
  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    if (onBlockUpdate && e.currentTarget.textContent !== null) {
      onBlockUpdate(block.id, block.block_type, e.currentTarget.textContent);
    }
  };

  // 处理拖拽开始
  const handleDragStart = (e: React.DragEvent) => {
    // 如果正在对齐，禁止拖拽
    if (localAligning) {
      e.preventDefault();
      return;
    }
    
    setIsDragging(true);
    
    // 设置两种数据格式，确保兼容性
    e.dataTransfer.setData('blockId', block.id);
    
    // 添加明确的类型标识，区分块排序拖拽和句子对齐拖拽
    try {
      const blockData = JSON.stringify({
        type: 'block',  // 明确标识这是块排序拖拽
        id: block.id
      });
      e.dataTransfer.setData('application/json', blockData);
    } catch (err) {
      console.error('无法设置拖拽数据', err);
    }
    
    e.dataTransfer.effectAllowed = 'move';
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // 处理拖拽悬停
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    
    // 检查是否是句子对齐拖拽 - 使用types来检查
    if (e.dataTransfer.types.includes('sentence-align-drag')) {
      // 这是句子对齐拖拽，整个块高亮
      setIsDragOver(true);
      setDropPosition(null); // 不需要位置指示器
      return;
    }
    
    // 这是块排序拖拽，显示位置指示器
    const rect = e.currentTarget.getBoundingClientRect();
    const posY = e.clientY - rect.top;
    
    if (posY < rect.height / 2) {
      setDropPosition('before');
    } else {
      setDropPosition('after');
    }
  };

  // 离开拖拽区域
  const handleDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);
    setDropPosition(null);
  };

  // 处理拖放
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropPosition(null);
    
    // 尝试从两种格式获取数据
    try {
      // 首先尝试读取JSON数据
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const data = JSON.parse(jsonData);
      
        // 检查类型标识 - 块排序
      if (data.type === 'block' && onOrderChange) {
          console.log('处理块排序拖拽:', data.id, block.id);
        const position = getDropPosition(e);
        onOrderChange(data.id, block.id, position);
        return;
      }
      
        // 检查类型标识 - 句子对齐（从SentencePlayer拖来的）
      if (data.type === 'sentence' && block.block_type === 'text') {
          console.log('处理句子对齐拖拽:', data);
        // 设置当前块为对齐中状态
        setLocalAligning(true);
        
        toast({
          title: "正在进行文本对齐",
          description: "请稍候，正在处理对齐...",
        });
        
        // 实际执行对齐操作
        const result = await TextAlignmentService.alignSentenceToBlock(
          block.id,
          data.sentenceId,
          data.speechId
        );
        
        if (result.success) {
            // 对齐成功处理
        } else {
            // 对齐失败处理
          setLocalAligning(false);
          toast({
            title: "对齐失败",
            description: result.message || "文本对齐处理失败",
            variant: "destructive",
          });
          }
        }
      } else {
        // 尝试读取blockId格式
        const blockId = e.dataTransfer.getData('blockId');
        if (blockId && onOrderChange) {
          console.log('处理块排序拖拽(blockId):', blockId, block.id);
          const position = getDropPosition(e);
          onOrderChange(blockId, block.id, position);
        }
      }
    } catch (error) {
      console.error('处理拖放操作失败:', error);
      setLocalAligning(false);
      toast({
        title: "操作失败",
        description: "处理拖放操作时出错",
        variant: "destructive",
      });
    }
  };

  // 简化单词播放函数
  const playWord = (word: any, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // 暂停所有正在播放的内容
    AudioController.pause();
    
    // 标记单词为活动状态
    setActiveWordId(word.id);
    
    // 播放单词
    AudioController.play(
      audioUrl || '',
      word.begin_time,
      word.end_time,
      `block-${block.id}-word-${word.id}`,
      () => setActiveWordId(null)
    );
  };

  // 添加这个函数来处理单词点击，但保留所有现有功能
  const handleWordClick = useCallback((word: any, sentenceIndex: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发句子点击
    isClicking.current = true;
    
    // 先找到句子
    const sentenceIds = getSentenceIdsFromContent();
    if (sentenceIndex >= 0 && sentenceIndex < sentenceIds.length) {
      const sentenceId = sentenceIds[sentenceIndex];
      const sentence = embeddedSentences.get(sentenceId);
      
      if (!sentence || !audioUrl) {
        console.error('无法播放单词：句子数据或音频URL缺失');
        return;
      }
      
      // 高亮当前句子
      setActiveIndex(sentenceIndex);
      
      // 高亮点击的单词
      setActiveWordId(word.id);
      
      // 获取单词时间戳
      const beginTime = word.begin_time;
      const endTime = word.end_time;
      
      if (beginTime === undefined || endTime === undefined) {
        console.error('单词缺少时间信息', word);
        return;
      }
      
      console.log(`播放单词 ${word.id}:`, beginTime, endTime);
      
      // 清除其他播放
      window.dispatchEvent(new CustomEvent(CLEAR_ACTIVE_SENTENCE_EVENT, {
        detail: { senderId: blockId }
      }));
      
      // 停止所有播放
      AudioController.stop();
      
      // 使用AudioController播放单词
      AudioController.play({
        url: audioUrl,
        startTime: beginTime,
        endTime: endTime,
        context: 'word',
        loop: false,
        playerId: `block-${block.id}-word-${word.id}`
      });
      
      // 更新父组件时间
      onTimeChange?.(beginTime);
      
      // 重置点击标志
      setTimeout(() => {
        isClicking.current = false;
      }, 100);
    }
  }, [audioUrl, blockId, block.id, embeddedSentences, getSentenceIdsFromContent, onTimeChange]);

  // 修改renderSentenceWithWords函数，区分单词高亮和句子高亮
  const renderSentenceWithWords = (sentence: any, sentenceIndex: number) => {
    // 检查句子文本内容的正确字段名
    const sentenceText = sentence.content || sentence.text_content;
    
    if (!sentenceText || !sentence.words || sentence.words.length === 0) {
      return <span>{sentenceText || sentence.content || '内容为空'}</span>;
    }

    // 按时间排序单词
    const sortedWords = [...sentence.words].sort((a, b) => a.begin_time - b.begin_time);
    
    const elements: React.ReactNode[] = [];
    let lastPosition = 0;
    const originalText = sentenceText;
    
    // 是否是当前活动句子
    const isActiveSentence = activeIndex === sentenceIndex;
    
    sortedWords.forEach((word, idx) => {
      // 检查单词内容的正确字段名
      const wordContent = word.content || word.word;
      if (!wordContent) {
        console.warn('单词内容为空:', word);
        return;
      }
      
      // 查找单词在原文中的位置
      const wordPosition = originalText.indexOf(wordContent, lastPosition);
      
      if (wordPosition >= 0) {
        // 添加单词前的文本（标点、空格等）
        if (wordPosition > lastPosition) {
          elements.push(
            <span key={`gap-${sentenceIndex}-${idx}`} className="text-muted-foreground">
              {originalText.substring(lastPosition, wordPosition)}
            </span>
          );
        }
        
        // 修改单词高亮逻辑
        const isWordActive = (word: any) => {
          // 如果是通过点击单词触发的高亮
          if (activeWordId === word.id) {
            return true;
          }
          
          // 如果是通过句子播放触发的高亮 
          return isActiveSentence && 
            currentAudioTime >= word.begin_time && 
            currentAudioTime < word.end_time;
        };
        
        // 只有在当前句子活动时才应用单词高亮
        const isWordActiveResult = isWordActive(word);
        
        // 修改添加单词的部分，使用金色粗边框和更快速度
        elements.push(
          <span 
            key={`word-${sentenceIndex}-${word.id}`}
            className="cursor-pointer px-0.5 relative"
            onClick={(e) => {
              handleWordClick(word, sentenceIndex, e);
            }}
          >
            <AnimatePresence>
              {isWordActiveResult && (
                <motion.span
                  className="absolute inset-0 rounded-sm"
                  style={{
                    borderColor: '#F5D742', // 金色边框
                    borderWidth: '2px',     // 更粗的边框
                    boxShadow: '0 0 3px rgba(245, 215, 66, 0.5)' // 金色阴影
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: 1,
                    transition: { duration: 0.1, ease: [0.22, 1, 0.36, 1] } // 更快的过渡
                  }}
                  exit={{ 
                    opacity: 0,
                    transition: { duration: 0.1, ease: [0.22, 1, 0.36, 1] } // 更快的过渡
                  }}
                  layoutId="word-highlight-flowing"
                />
              )}
            </AnimatePresence>
            <span className={isWordActiveResult ? "text-amber-500 font-medium relative z-10" : "hover:text-amber-400"}>
            {wordContent}
            </span>
          </span>
        );
        
        lastPosition = wordPosition + wordContent.length;
      }
    });
    
    // 添加最后一个单词后的剩余文本
    if (lastPosition < originalText.length) {
      elements.push(
        <span key={`final-gap-${sentenceIndex}`} className="text-muted-foreground">
          {originalText.substring(lastPosition)}
        </span>
      );
    }

    return <span>{elements}</span>;
  };

  // 添加getDropPosition函数实现
  const getDropPosition = (e: React.DragEvent): 'before' | 'after' => {
    const rect = e.currentTarget.getBoundingClientRect();
    const posY = e.clientY - rect.top;
    
    // 如果鼠标位置在元素上半部分，则放置在元素前面
    // 否则放置在元素后面
    return posY < rect.height / 2 ? 'before' : 'after';
  };

  // 添加渲染嵌入式内容的函数
  const renderEmbeddedContent = () => {
    if (!block.content) return <span>内容为空</span>;
    
    // 如果没有嵌入式句子，直接返回内容
    if (!block.content.includes('[[')) {
      return <span>{block.content}</span>;
    }
    
    // 拆分内容并替换嵌入式句子
    const segments = [];
    let lastIndex = 0;
    let segmentIndex = 0;
    
    // 使用正则表达式找到所有嵌入式句子
    const pattern = /\[\[([a-f0-9-]+)\]\]/g;
    let match;
    
    while ((match = pattern.exec(block.content)) !== null) {
      // 添加句子前的文本
      if (match.index > lastIndex) {
        segments.push(
          <span key={`text-${segmentIndex}`} className="text-muted-foreground">
            {block.content.substring(lastIndex, match.index)}
          </span>
        );
        segmentIndex++;
      }
      
      // 获取句子ID
      const sentenceId = match[1];
      const sentence = embeddedSentences.get(sentenceId);
      
      // 添加句子（如果已加载）
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
              // 阻止事件冒泡，确保点击事件被正确处理
              e.stopPropagation();
              playSentence(sentence, sentenceIndex);
            }}
          >
            {/* 微型播放图标 */}
            <span className={cn(
              "inline-flex items-center justify-center w-3 h-3 mr-0.5 align-text-bottom rounded-full",
              activeIndex === sentenceIndex && isPlaying
                ? "bg-emerald-100" 
                : "bg-transparent group-hover:bg-accent/5"
            )}
            onClick={(e) => {
              // 为图标添加特定的点击处理
              e.stopPropagation();
              playSentence(sentence, sentenceIndex);
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
        // 句子尚未加载时显示占位符
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
    if (lastIndex < block.content.length) {
      segments.push(
        <span key={`text-final`} className="text-muted-foreground">
          {block.content.substring(lastIndex)}
        </span>
      );
    }
    
    return <span>{segments}</span>;
  };

  // 修改现有的renderContent函数
  const renderContent = () => {
    // 图片语境块
    if (block.block_type === 'image' && resources) {
      const imgPath = block.content.replace('![', '').replace(/\]\(.+\)/, '');
      const resource = resources.find(r => r.original_path.includes(imgPath) || r.oss_path.includes(imgPath));
      
      if (resource) {
        return (
          <div className="relative max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resource.oss_path}
              alt={`图片${block.id}`}
              className="max-w-full h-auto rounded-md"
            />
            {/* 我们使用img标签而不是Image组件是为了确保图片质量不受影响 */}
          </div>
        );
      }
      
      return <div className="text-sm text-muted-foreground">图片未找到: {imgPath}</div>;
    }
    
    // 音频对齐块 - 增加显示alignment数据的选项
    if (block.block_type === 'audio_aligned') {
      return (
        <div className="audio-aligned-block relative">
          {/* 主要内容 - 减少内部缩进 */}
          <div className="py-2 px-3 text-sm leading-relaxed">
          <div className="prose prose-sm max-w-none">
            {isLoadingSentences ? (
              <span className="text-muted-foreground">加载句子内容中...</span>
            ) : (
              renderEmbeddedContent()
            )}
            </div>
          </div>
          
          {/* 底部功能图标栏 - 放在语境块外部但靠近底部 */}
          <div className="absolute right-1 bottom-1 flex gap-1">
            {/* 源文本查看图标 */}
            <button
              onClick={() => onShowSplitView?.(block.id, 'source')}
              className="p-0.5 rounded-full bg-background/80 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
              title="对齐前文本"
            >
              <Music2 className="h-3 w-3" />
            </button>
            
            {/* 翻译图标（预留） */}
            <button
              onClick={() => toast({
                title: "翻译功能开发中",
                description: "敬请期待",
                variant: "default",
              })}
              className="p-0.5 rounded-full bg-background/80 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
              title="翻译"
            >
              <Globe className="h-3 w-3" />
            </button>
            
            {/* 节点图标（预留） */}
            <button
              onClick={() => toast({
                title: "节点功能开发中",
                description: "敬请期待",
                variant: "default",
              })}
              className="p-0.5 rounded-full bg-background/80 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
              title="查看节点"
            >
              <Network className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }
    
    // 包含嵌入式句子的文本块 - 使用相同的渲染方式
    if (block.block_type === 'text' && block.content && block.content.includes('[[')) {
      return (
        <div className="embedded-sentences-block py-2 px-3 text-sm leading-relaxed">
          <div className="prose prose-sm max-w-none">
            {isLoadingSentences ? (
              <span className="text-muted-foreground">加载句子内容中...</span>
            ) : (
              renderEmbeddedContent()
            )}
          </div>
        </div>
      );
    }
    
    // 普通文本块 - 直接可编辑
    return (
      <div
        ref={contentEditableRef}
        contentEditable={block.block_type === 'text'}
        suppressContentEditableWarning
        className="text-sm outline-none whitespace-pre-wrap"
        onBlur={handleContentChange}
        onKeyDown={(e) => {
          // 按Enter但不按Shift创建新块
          if (e.key === 'Enter' && !e.shiftKey) {
            // 创建新块的代码 - 需要由父组件处理
            e.preventDefault();
          }
        }}
      >
        {renderEmbeddedContent()}
      </div>
    );
  };

  // 在ContentBlock中添加对全局循环模式的响应
  useEffect(() => {
    // 监听全局循环模式变更
    const handleLoopModeChange = (e: CustomEvent) => {
      const { mode } = e.detail;
      if (mode && ['sentence', 'block', 'continuous'].includes(mode)) {
        // 更新本地循环模式
        // 注意：这里假设你的组件有一个prop或state来存储playMode
        if (onPlayModeChange) {
          onPlayModeChange(mode);
        }
      }
    };
    
    window.addEventListener('global-loop-mode-change', handleLoopModeChange as EventListener);
    
    return () => {
      window.removeEventListener('global-loop-mode-change', handleLoopModeChange as EventListener);
    };
  }, [onPlayModeChange]);

  // 修改句子点击处理函数
  const handleSentenceClick = useCallback((sentence: any, sentenceIndex: number) => {
    isClicking.current = true;
    
    // 播放句子
    playSentence(sentence, sentenceIndex);
    
    // 点击后重置标志
    setTimeout(() => {
      isClicking.current = false;
    }, 100);
  }, [playSentence]);

  // 恢复关键的事件处理函数，这是我之前删除的
  // 处理句子播放事件
  useEffect(() => {
    const handlePlayBlockSentence = (e: CustomEvent) => {
      const { blockId, sentenceIndex } = e.detail;
      
      if (blockId === block.id) {
        console.log(`接收到播放事件: 块=${blockId}, 句子索引=${sentenceIndex}`);
        
        // 如果没有加载句子数据，需要先加载
        if (embeddedSentences.size === 0) {
          parseAndLoadEmbeddedSentences().then(() => {
            triggerPlaySentence(sentenceIndex);
          });
        } else {
          triggerPlaySentence(sentenceIndex);
        }
      }
    };
    
    // 直接播放指定索引的句子
    const triggerPlaySentence = (sentenceIndex: number) => {
      // 从content中提取所有句子ID
      const sentenceIds: string[] = [];
      const pattern = /\[\[([a-f0-9-]+)\]\]/g;
      let match;
      while ((match = pattern.exec(block.content || '')) !== null) {
        sentenceIds.push(match[1]);
      }
      
      // 确保索引有效
      if (sentenceIndex >= 0 && sentenceIndex < sentenceIds.length) {
        const sentenceId = sentenceIds[sentenceIndex];
        const sentence = embeddedSentences.get(sentenceId);
        
        if (sentence) {
          // 实际开始播放
          console.log(`开始播放句子: ${sentenceId}, 索引: ${sentenceIndex}`);
          playSentence(sentence, sentenceIndex);
        } else {
          console.error(`句子数据未找到: ${sentenceId}`);
        }
      }
    };
    
    window.addEventListener(
      'play-block-sentence', 
      handlePlayBlockSentence as EventListener
    );
    
    return () => {
      window.removeEventListener(
        'play-block-sentence', 
        handlePlayBlockSentence as EventListener
      );
    };
  }, [block.id, block.content, embeddedSentences, parseAndLoadEmbeddedSentences, playSentence]);

  // 修改音频结束事件监听，增加精确的事件判断
  useEffect(() => {
    const handleAudioEnd = (e: CustomEvent) => {
      const { context, playerId } = e.detail;
      
      // 检查是否是当前块的播放结束
      const currentBlockRegex = new RegExp(`^block-${block.id}-sentence-`);
      const isCurrentBlockAudio = currentBlockRegex.test(playerId || '');
      
      console.log(`音频结束事件 - playerId: ${playerId}, 匹配当前块: ${isCurrentBlockAudio}`);
      
      // 只有当是当前块的音频时才清除高亮
      if (isCurrentBlockAudio) {
        console.log(`清除块 ${block.id} 的高亮`);
        setActiveIndex(null);
        setActiveWordId(null);
        setIsPlaying(false);
      }
    };
    
    window.addEventListener(AUDIO_EVENTS.END, handleAudioEnd as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_EVENTS.END, handleAudioEnd as EventListener);
    };
  }, [block.id]);

  // 组件卸载时清除自己的高亮
  useEffect(() => {
    return () => {
      // 组件卸载时发送事件清除自己的高亮
      window.dispatchEvent(new CustomEvent(CLEAR_ACTIVE_SENTENCE_EVENT, {
        detail: { blockId: block.id, cleanup: true }
      }));
    };
  }, [block.id]);

  // 添加监听活跃块变化的事件
  useEffect(() => {
    const handleActiveBlockChanged = (e: CustomEvent) => {
      const { activeBlockId } = e.detail;
      
      // 如果另一个块变为活跃，清除当前块的高亮
      if (activeBlockId !== block.id) {
        console.log(`块 ${block.id} 清除高亮 (活跃块变为 ${activeBlockId})`);
        setActiveIndex(null);
        setIsPlaying(false);
        setActiveWordId(null);
      }
    };
    
    window.addEventListener(ACTIVE_BLOCK_CHANGED_EVENT, handleActiveBlockChanged as EventListener);
    
    return () => {
      window.removeEventListener(ACTIVE_BLOCK_CHANGED_EVENT, handleActiveBlockChanged as EventListener);
    };
  }, [block.id]);

  return (
    <div
      ref={blockRef}
      className={cn(
        'group relative my-1 p-2 rounded-md transition-all duration-300',
        isSelected ? 'bg-accent/20 border border-primary/30' : 'hover:bg-accent/10 border border-transparent',
        isDragOver ? 'border-2 border-dashed border-primary/50 bg-primary/5' : '',
        dropPosition === 'before' ? 'border-t-2 border-t-primary' : '',
        dropPosition === 'after' ? 'border-b-2 border-b-primary' : '',
        localAligning ? 'bg-primary/5 border border-primary/30 shadow-md' : '',
        showCompleteAnimation ? 'alignment-complete' : ''
      )}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* 拖拽手柄 - 对不同块类型使用不同位置 */}
      <div className={cn(
        "absolute flex items-center justify-center opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity",
        block.block_type === 'audio_aligned' 
          ? "left-2 top-3 w-8 h-8" 
          : "left-0 top-0.5 w-8 h-8"
      )}>
        <DragHandleDots2Icon className="h-6 w-6 text-muted-foreground cursor-grab" />
      </div>
      
      
      {/* 块内容 */}
      <div className="pl-6">
        {renderContent()}
      </div>
      
      {/* 对齐中状态指示器 */}
      {localAligning && (
        <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px] rounded-md flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <div className="text-sm font-medium">正在对齐文本...</div>
            <div className="text-xs text-muted-foreground mt-1">请稍候片刻</div>
          </div>
        </div>
      )}
    </div>
  );
} 