import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import { Play, Pause, Loader2, FileText, FileEdit, Music2, Globe, Network, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextAlignmentService } from '@/lib/services/text-alignment';
import { supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import Image from 'next/image';
import { AudioController, AUDIO_EVENTS } from '@/lib/audio-controller';
import { AnimatePresence, motion } from "framer-motion";
import { AnchorWordBlock, SelectedWord } from './AnchorWordBlock';
import { AnchorHighlightRenderer } from './AnchorHighlightRenderer';
import { type MeaningBlockFormatted } from '@/lib/services/meaning-blocks-service';

interface ContextBlocksProps {
  block: {
    id: string;
    block_type: string;
    content: string;
    original_content?: string;
    metadata?: Record<string, any>;
    order_index: number;
    speech_id?: string;
  };
  resources?: Array<{ original_path: string; oss_path: string }>;
  onBlockUpdate?: (blockId: string, newType: string, content: string) => void;
  onOrderChange?: (draggedId: string, droppedId: string, position: 'before' | 'after') => void;
  isSelected?: boolean;
  onSelect?: (blockId: string | null, event: React.MouseEvent) => void;
  audioUrl?: string;
  onTimeChange?: (time: number) => void;
  isAligning?: boolean;
  onAlignmentComplete?: (blockId: string) => void;
  playMode?: 'sentence' | 'block' | 'continuous';
  onPlayNext?: (blockId: string, lastSentenceIndex: number) => void;
  onPlayModeChange?: (newMode: 'sentence' | 'block' | 'continuous') => void;
  onShowSplitView?: (blockId: string, type: 'source' | 'translation') => void;
  activeBlockId: string | null;
  onAnchorWordsChange?: (blockId: string, words: SelectedWord[]) => void;
  onEnterAnchorMode?: () => void;
  onExitAnchorMode?: () => void;
  anchorSelectedWords?: SelectedWord[];
  meaningBlocks?: MeaningBlockFormatted[];
  loadingMeaningBlocks?: boolean;
  isInAnchorMode?: boolean;
}

// 添加一个全局活跃块ID事件
const ACTIVE_BLOCK_CHANGED_EVENT = 'active-block-changed';

// 添加这行代码，定义 CLEAR_ACTIVE_SENTENCE_EVENT
const CLEAR_ACTIVE_SENTENCE_EVENT = 'clear-active-sentences';

export function ContextBlocks({ 
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
  onShowSplitView,
  activeBlockId,
  onAnchorWordsChange,
  onEnterAnchorMode,
  onExitAnchorMode,
  anchorSelectedWords = [],
  meaningBlocks = [],
  loadingMeaningBlocks = false,
  isInAnchorMode = false,
}: ContextBlocksProps) {
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
  const [blockSpeechId, setBlockSpeechId] = useState<string | undefined>(block.speech_id);
  
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);
  const [loopMode, setLoopMode] = useState<'sentence' | 'block' | 'continuous'>('continuous');
  const [audioContext, setAudioContext] = useState<'sentence' | 'block' | 'word' | 'main'>('main');
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number | null>(null);
  
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
    console.log('[ContextBlocks] 播放句子', {
      index,
      sentence,
      playMode,
      isPlaying,
      activeIndex
    });
    
    // 如果点击当前播放的句子，则停止播放
    if (activeIndex === index && isPlaying) {
      console.log('[ContextBlocks] 停止当前句子播放');
      AudioController.stop();
      setIsPlaying(false);
      setActiveIndex(null);
      setActiveWordId(null);
      return;
    }
    
    // 广播当前活跃块ID
    console.log('[ContextBlocks] 广播活跃块ID', { blockId: block.id });
    window.dispatchEvent(new CustomEvent(ACTIVE_BLOCK_CHANGED_EVENT, {
      detail: { activeBlockId: block.id }
    }));
    
    // 始终先停止所有播放
    AudioController.stop();
    
    // 检查句子数据
    if (!sentence || !audioUrl) {
      console.error('[ContextBlocks] 无法播放：句子数据或音频URL缺失', { sentence, audioUrl });
      return;
    }
    
    // 获取时间范围
    const beginTime = sentence.begin_time;
    const endTime = sentence.end_time;
    
    if (beginTime === undefined || endTime === undefined) {
      console.error('[ContextBlocks] 句子缺少时间信息', sentence);
      return;
    }
    
    console.log(`[ContextBlocks] 准备播放句子`, {
      index,
      beginTime,
      endTime,
      playMode
    });
    
    // 先设置状态，确保UI立即反应
    setActiveIndex(index);
    setIsPlaying(true);
    
    // 根据当前播放模式设置循环
    const shouldLoop = playMode === 'sentence';
    
    // 使用AudioController播放
    AudioController.play({
      url: audioUrl,
      startTime: beginTime,
      endTime: endTime,
      context: 'sentence',
      loop: shouldLoop,
      onEnd: () => {
        if (!shouldLoop) {
          console.log('[ContextBlocks] 非循环模式播放结束，清除状态');
          setActiveIndex(null);
          setIsPlaying(false);
          setActiveWordId(null);
        }
      }
    });
    
    // 更新父组件时间
    onTimeChange?.(beginTime);
  }, [activeIndex, isPlaying, audioUrl, block.id, onTimeChange, playMode]);

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
      const { currentTime } = e.detail;
      
      const adjustedTime = currentTime + 0.5;
      setCurrentAudioTime(adjustedTime);
      if (isClicking.current) return;

      const sentenceIds = getSentenceIdsFromContent();

      if (sentenceIds.length === 0 || embeddedSentences.size === 0) {
        if (activeIndex !== null || isPlaying) {
          setActiveIndex(null);
          setIsPlaying(false);
          setActiveWordId(null);
          if (activeBlockId === block.id) {
            onSelect?.(null, {} as React.MouseEvent);
          }
        }
        return;
      }

      let inAnySentenceRange = false;

      for (let i = 0; i < sentenceIds.length; i++) {
        const sentenceId = sentenceIds[i];
        const sentence = embeddedSentences.get(sentenceId);

        if (!sentence) continue;

        if (adjustedTime >= sentence.begin_time &&
            adjustedTime <= sentence.end_time) {
          inAnySentenceRange = true;

          if (activeIndex !== i) {
            console.log(`[ContextBlocks] 进入新句子范围`, {
              index: i,
              currentTime: adjustedTime,
              beginTime: sentence.begin_time,
              endTime: sentence.end_time,
              playMode
            });
            
            setActiveIndex(i);
            setIsPlaying(true);
            onSelect?.(block.id, {} as React.MouseEvent);

            // 只在句子循环模式下设置循环范围
            if (playMode === 'sentence') {
              AudioController.setPlayMode('sentence', sentence.begin_time, sentence.end_time);
            } else if (playMode === 'block' && i === 0) {
              // 在块循环模式下，只在进入第一句时设置整个块的循环范围
              const lastSentence = embeddedSentences.get(sentenceIds[sentenceIds.length - 1]);
              if (lastSentence) {
                AudioController.setPlayMode('block', sentence.begin_time, lastSentence.end_time);
              }
            }
          }

          // 单词高亮逻辑
          if (sentence.words && Array.isArray(sentence.words)) {
            let newActiveWordId = null;
            for (const word of sentence.words) {
              if (adjustedTime >= word.begin_time &&
                  adjustedTime <= word.end_time) {
                newActiveWordId = word.id;
                break;
              }
            }
            if (newActiveWordId !== activeWordId) {
              setActiveWordId(newActiveWordId);
            }
          }
          break;
        }
      }

      if (!inAnySentenceRange) {
        if (activeIndex !== null || isPlaying) {
          console.log('[ContextBlocks] 超出句子范围，清除高亮');
          setActiveIndex(null);
          setIsPlaying(false);
          setActiveWordId(null);
          if (activeBlockId === block.id) {
            onSelect?.(null, {} as React.MouseEvent);
          }
        }
      }
    };
    
    window.addEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    };
  }, [activeIndex, isPlaying, embeddedSentences, getSentenceIdsFromContent, activeBlockId, block.id, onSelect, activeWordId, playMode]);

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

  // 加载 context_blocks 数据
  useEffect(() => {
    async function loadContextBlock() {
      if (block.block_type === 'audio_aligned') {
        try {
          console.log('开始加载语境块数据:', block.id);
          const { data, error } = await supabase
            .from('context_blocks')
            .select('speech_id')
            .eq('id', block.id)
            .single();

          if (error) throw error;
          if (data?.speech_id) {
            console.log('获取到语境块 speech_id:', data.speech_id);
            setBlockSpeechId(data.speech_id);
          }
        } catch (err) {
          console.error('加载语境块数据失败:', err);
        }
      }
    }

    loadContextBlock();
  }, [block.id, block.block_type]);

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
          
          toast("正在进行文本对齐", { description: "请稍候，正在处理对齐..." });
          
          // 发送对齐开始事件（仅记录日志，不实际执行操作）
          console.log('ContextBlocks: 发送对齐开始事件');
          
          // 实际执行对齐操作
          let result;
          try {
            result = await TextAlignmentService.alignSentenceToBlock(
              block.id,
              data.sentenceId,
              data.speechId
            );
          } catch (error) {
            console.error('对齐操作失败:', error);
            // 发送失败事件，让SentencePlayer知道可以取消对齐状态
            window.dispatchEvent(new CustomEvent('sentence-alignment-update', {
              detail: {
                sentenceId: data.sentenceId,
                blockId: block.id,
                status: 'failed',
                shouldSkipPageChange: true,
                alignedSentenceIds: [], // 对齐失败，没有句子被对齐
                isDragging: true // 这是拖拽引起的对齐
              }
            }));
            
            setLocalAligning(false);
            toast.error("对齐处理失败，请重试");
            return;
          }
          
          if (result.success) {
            // 对齐成功处理
            console.log('ContextBlocks: 对齐成功, 发送更新事件:', result);
            
            // 获取所有被对齐的句子ID
            const alignedSentenceIds = result.alignedSentences.map(s => s.sentenceId);
            console.log('ContextBlocks: 被对齐的句子IDs:', alignedSentenceIds);
            
            // 发送对齐更新事件，传递所有被对齐的句子ID
            window.dispatchEvent(new CustomEvent('sentence-alignment-update', {
              detail: {
                sentenceId: data.sentenceId, // 主要拖拽的句子ID
                blockId: block.id,
                status: 'processing',
                shouldSkipPageChange: data.shouldSkipPageChange,
                alignedSentenceIds: alignedSentenceIds, // 所有被对齐的句子ID列表
                isDragging: true, // 这是拖拽引起的对齐
                targetPage: data.targetPage, // 传递目标页码
                isProcessing: true // 标记为处理中
              }
            }));
            
            // TextAlignmentService.alignSentenceToBlock方法已经使用await执行了三个步骤：
            // 1. 保存基础数据
            // 2. 执行单词级对齐
            // 3. 创建元数据关联
            console.log('ContextBlocks: TextAlignmentService处理已完成，等待数据库更新...');
            
            // 直接发送成功事件，不再使用轮询检查
            console.log('ContextBlocks: 发送对齐完成事件');
            window.dispatchEvent(new CustomEvent('sentence-alignment-complete', {
              detail: {
                sentenceId: data.sentenceId,
                blockId: block.id,
                status: 'success',
                shouldSkipPageChange: data.shouldSkipPageChange,
                alignedSentenceIds: alignedSentenceIds,
                targetPage: data.targetPage,
                isDragging: true // 这是拖拽引起的对齐
              }
            }));
            
            // 更新本地状态
            setLocalAligning(false);
            
            // 通知父组件对齐完成
            onAlignmentComplete?.(block.id);
            
            toast.success("文本对齐完成");
          } else {
            // 对齐失败处理
            console.error('ContextBlocks: 对齐失败:', result.message);
            
            // 发送失败事件，让SentencePlayer知道可以取消对齐状态
            window.dispatchEvent(new CustomEvent('sentence-alignment-update', {
              detail: {
                sentenceId: data.sentenceId,
                blockId: block.id,
                status: 'failed',
                shouldSkipPageChange: true,
                alignedSentenceIds: [], // 对齐失败，没有句子被对齐
                isDragging: true // 这是拖拽引起的对齐
              }
            }));
            
            setLocalAligning(false);
            toast.error(result.message || "文本对齐处理失败");
          }
        }
      }
      // 尝试读取blockId格式
      const blockId = e.dataTransfer.getData('blockId');
      if (blockId && onOrderChange) {
        console.log('处理块排序拖拽(blockId):', blockId, block.id);
        const position = getDropPosition(e);
        onOrderChange(blockId, block.id, position);
      }
    } catch (error) {
      console.error('处理拖放操作失败:', error);
      setLocalAligning(false);
      toast.error("处理拖放操作时出错");
      
      // 捕获到异常时，也发送失败事件，确保SentencePlayer能恢复正常状态
      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) {
          const data = JSON.parse(jsonData);
          if (data.type === 'sentence') {
            window.dispatchEvent(new CustomEvent('sentence-alignment-update', {
              detail: {
                sentenceId: data.sentenceId,
                status: 'failed',
                shouldSkipPageChange: true
              }
            }));
          }
        }
      } catch (err) {
        console.error('无法发送失败事件:', err);
      }
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
    AudioController.play({
      url: audioUrl || '',
      startTime: word.begin_time,
      endTime: word.end_time,
      onEnd: () => setActiveWordId(null)
    });
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
        speechId: blockSpeechId,
        onEnd: () => {
            // 单词播放结束后的操作
            setActiveWordId(null);
        }
      });
      
      // 更新父组件时间
      onTimeChange?.(beginTime);
      
      // 重置点击标志
      setTimeout(() => {
        isClicking.current = false;
      }, 100);
    }
  }, [audioUrl, blockId, block.id, embeddedSentences, getSentenceIdsFromContent, onTimeChange, blockSpeechId]);

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
          // 如果是通过点击单词触发的高亮, 或者当前就是高亮
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
            {isWordActiveResult && (
              <motion.span
                className="absolute inset-0 rounded-sm word-highlight-flowing"
                layoutId="word-highlight-flowing"
              />
            )}
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

  // 获取用于锚定词块的内容
  const getAnchorContent = useCallback(() => {
    // 如果是音频对齐块，使用 original_content；否则使用 content
    return block.block_type === 'audio_aligned' 
      ? (block.original_content || block.content)
      : block.content;
  }, [block.block_type, block.content, block.original_content]);

  // 处理锚定词块选词变化
  const handleAnchorWordsChange = useCallback((words: SelectedWord[]) => {
    onAnchorWordsChange?.(block.id, words);
  }, [block.id, onAnchorWordsChange]);

  // 进入锚定模式
  const handleEnterAnchorMode = useCallback(() => {
    onEnterAnchorMode?.();
  }, [onEnterAnchorMode]);

  // 退出锚定模式
  const handleExitAnchorMode = useCallback(() => {
    onExitAnchorMode?.();
  }, [onExitAnchorMode]);

  // 渲染含义块信息
  const renderMeaningBlocksInfo = () => {
    return null; // 不再显示含义块计数
  };

  // 修改renderContent函数，添加含义块信息显示
  const renderContent = () => {
    // 如果处于锚定模式，渲染锚定词块
    if (isInAnchorMode) {
      return (
        <AnchorWordBlock
          content={getAnchorContent()}
          blockId={block.id}
          onSelectedWordsChange={handleAnchorWordsChange}
          onExit={handleExitAnchorMode}
          initialSelectedWords={anchorSelectedWords}
          existingMeaningBlocks={meaningBlocks}
        />
      );
    }

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
            
            {/* 渲染含义块信息 */}
            {renderMeaningBlocksInfo()}
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
          
          {/* 渲染含义块信息 */}
          {renderMeaningBlocksInfo()}
          
          {/* 底部功能图标栏 - 放在语境块外部但靠近底部 */}
          <div className="absolute right-1 bottom-1 flex gap-1">
            {/* 对齐记录图标 */}
            <button
              onClick={() => onShowSplitView?.(block.id, 'source')}
              className="p-0.5 rounded-full bg-background/80 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
              title="对齐记录"
            >
              <FileEdit className="h-3 w-3" />
            </button>
            
            {/* 翻译图标 */}
            <button
              onClick={() => toast("翻译功能开发中", { description: "敬请期待" })}
              className="p-0.5 rounded-full bg-background/80 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
              title="翻译"
            >
              <Globe className="h-3 w-3" />
            </button>
            
            {/* 词锚点图标 - 新增 */}
            <button
              onClick={handleEnterAnchorMode}
              className="p-0.5 rounded-full bg-background/80 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-all"
              title="词锚点"
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
        <div className="embedded-sentences-block relative py-2 px-3 text-sm leading-relaxed">
          <div className="prose prose-sm max-w-none">
            {isLoadingSentences ? (
              <span className="text-muted-foreground">加载句子内容中...</span>
            ) : (
              renderEmbeddedContent()
            )}
          </div>
          
          {/* 渲染含义块信息 */}
          {renderMeaningBlocksInfo()}
          
          {/* 为包含嵌入式句子的文本块也添加词锚点按钮 */}
          <div className="absolute right-1 bottom-1 flex gap-1">
            <button
              onClick={handleEnterAnchorMode}
              className="p-0.5 rounded-full bg-background/80 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-all"
              title="词锚点"
            >
              <Network className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }
    
    // 普通文本块 - 直接可编辑
    return (
      <div className="relative">
        {/* 如果有含义块数据，使用锚点高亮渲染器 */}
        {meaningBlocks.length > 0 ? (
          <AnchorHighlightRenderer
            content={block.content}
            meaningBlocks={meaningBlocks}
            className="py-2 px-3"
          />
        ) : (
      <div
        ref={contentEditableRef}
        contentEditable={block.block_type === 'text'}
        suppressContentEditableWarning
            className="text-sm outline-none whitespace-pre-wrap py-2 px-3"
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
        )}
        
        {/* 渲染含义块信息 */}
        {renderMeaningBlocksInfo()}
        
        {/* 为普通文本块也添加词锚点按钮 */}
        {block.block_type === 'text' && block.content && (
          <div className="absolute right-1 bottom-1 flex gap-1">
            <button
              onClick={handleEnterAnchorMode}
              className="p-0.5 rounded-full bg-background/80 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100 transition-opacity"
              title="词锚点"
            >
              <Network className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // 在ContextBlocks中添加对全局循环模式的响应
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

  // 使用 isBlockActive 来区分 prop 中的 isSelected
  const isBlockActive = activeBlockId === block.id;

  // 在组件顶部添加事件监听
  useEffect(() => {
    const handleAudioSwitch = (e: CustomEvent) => {
      toast("检测到不同音频，停顿跳转中", {
        duration: 2000,  // 显示2秒
        className: "bg-primary/10",  // 可选：自定义样式
      });
    };

    window.addEventListener('audio-switch-start', handleAudioSwitch as EventListener);
    
    return () => {
      window.removeEventListener('audio-switch-start', handleAudioSwitch as EventListener);
    };
  }, []);

  // 修改播放模式变化的useEffect
  useEffect(() => {
    if (!audioUrl || activeIndex === null) return;
    
    console.log('[ContextBlocks] 播放模式变化', {
      playMode,
      activeIndex,
      audioUrl
    });
    
    // 获取当前句子的时间范围
    const sentenceIds = getSentenceIdsFromContent();
    if (activeIndex >= 0 && activeIndex < sentenceIds.length) {
      const sentenceId = sentenceIds[activeIndex];
      const sentence = embeddedSentences.get(sentenceId);
      
      if (sentence) {
        console.log('[ContextBlocks] 当前活动句子', {
          sentenceId,
          beginTime: sentence.begin_time,
          endTime: sentence.end_time
        });
        
        // 根据播放模式设置循环
        switch (playMode) {
          case 'sentence':
            console.log('[ContextBlocks] 切换到句子循环模式');
            AudioController.setPlayMode('sentence', sentence.begin_time, sentence.end_time);
            break;
          
          case 'block':
            // 语境块循环 - 使用整个块的时间范围
            const firstSentence = embeddedSentences.get(sentenceIds[0]);
            const lastSentence = embeddedSentences.get(sentenceIds[sentenceIds.length - 1]);
            
            if (firstSentence && lastSentence) {
              console.log('[ContextBlocks] 切换到块循环模式', {
                blockStart: firstSentence.begin_time,
                blockEnd: lastSentence.end_time
              });
              AudioController.setPlayMode('block', firstSentence.begin_time, lastSentence.end_time);
            }
            break;
        }
      }
    }
  }, [playMode, activeIndex, audioUrl, embeddedSentences, getSentenceIdsFromContent]);

  // 添加对循环事件的监听
  useEffect(() => {
    const handleAudioLoop = (e: CustomEvent) => {
      const { startTime, endTime, mode } = e.detail;
      
      console.log('[ContextBlocks] 收到循环事件', {
        startTime,
        endTime,
        mode,
        blockId: block.id
      });
      
      // 检查是否是当前块的循环
      const sentenceIds = getSentenceIdsFromContent();
      const firstSentence = embeddedSentences.get(sentenceIds[0]);
      const lastSentence = embeddedSentences.get(sentenceIds[sentenceIds.length - 1]);
      
      if (firstSentence && lastSentence) {
        const blockStart = firstSentence.begin_time;
        const blockEnd = lastSentence.end_time;
        
        console.log('[ContextBlocks] 检查循环范围', {
          blockStart,
          blockEnd,
          loopStart: startTime,
          loopEnd: endTime
        });
        
        // 如果循环范围在当前块内，更新状态
        if (startTime >= blockStart && endTime <= blockEnd) {
          // 找到对应的句子索引
          for (let i = 0; i < sentenceIds.length; i++) {
            const sentence = embeddedSentences.get(sentenceIds[i]);
            if (sentence && sentence.begin_time === startTime) {
              console.log('[ContextBlocks] 找到循环句子', {
                index: i,
                sentenceId: sentenceIds[i]
              });
              setActiveIndex(i);
              setIsPlaying(true);
              break;
            }
          }
        }
      }
    };
    
    window.addEventListener('audio-loop', handleAudioLoop as EventListener);
    
    return () => {
      window.removeEventListener('audio-loop', handleAudioLoop as EventListener);
    };
  }, [getSentenceIdsFromContent, embeddedSentences, block.id]);

  // 添加对模式变更事件的监听
  useEffect(() => {
    const handleAudioModeChange = (e: CustomEvent) => {
      const { mode, currentTime, endTime } = e.detail;
      
      // 检查是否是当前块的模式变更
      const sentenceIds = getSentenceIdsFromContent();
      const firstSentence = embeddedSentences.get(sentenceIds[0]);
      const lastSentence = embeddedSentences.get(sentenceIds[sentenceIds.length - 1]);
      
      if (firstSentence && lastSentence) {
        const blockStart = firstSentence.begin_time;
        const blockEnd = lastSentence.end_time;
        
        // 如果时间范围在当前块内，更新状态
        if (currentTime >= blockStart && currentTime <= blockEnd) {
          // 找到对应的句子索引
          for (let i = 0; i < sentenceIds.length; i++) {
            const sentence = embeddedSentences.get(sentenceIds[i]);
            if (sentence && 
                currentTime >= sentence.begin_time && 
                currentTime <= sentence.end_time) {
              setActiveIndex(i);
              setIsPlaying(true);
              break;
            }
          }
        }
      }
    };
    
    window.addEventListener('audio-mode-change', handleAudioModeChange as EventListener);
    
    return () => {
      window.removeEventListener('audio-mode-change', handleAudioModeChange as EventListener);
    };
  }, [getSentenceIdsFromContent, embeddedSentences]);

  // 添加ContextBlocks组件的useEffect来处理单词对齐完成事件
  useEffect(() => {
    // 监听words-alignment-complete事件，刷新单词数据
    const handleWordsAlignmentComplete = (e: CustomEvent) => {
      const detail = e.detail as { 
        sentenceIds?: string[],
        speechId?: string,
        blockId?: string
      };
      
      // 检查是否是针对当前块的事件
      if (detail.blockId === block.id) {
        console.log('ContextBlocks: 收到单词对齐完成事件，刷新单词数据', detail);
        
        // 重新加载涉及到的句子数据
        if (detail.sentenceIds && detail.sentenceIds.length > 0) {
          parseAndLoadEmbeddedSentences();
        }
      }
    };
    
    window.addEventListener('words-alignment-complete', handleWordsAlignmentComplete as EventListener);
    
    return () => {
      window.removeEventListener('words-alignment-complete', handleWordsAlignmentComplete as EventListener);
    };
  }, [block.id, parseAndLoadEmbeddedSentences]);

  return (
    <div
      ref={blockRef}
      className={cn(
        'group relative my-1 p-2 rounded-md transition-all duration-300',
        isBlockActive ? 'bg-accent/20 border border-primary/30' : 'hover:bg-accent/10 border border-transparent',
        isDragOver ? 'border-2 border-dashed border-primary/50 bg-primary/5' : '',
        dropPosition === 'before' ? 'border-t-2 border-t-primary' : '',
        dropPosition === 'after' ? 'border-b-2 border-b-primary' : '',
        localAligning ? 'bg-primary/5 border border-primary/30 shadow-md' : '',
        showCompleteAnimation ? 'alignment-complete' : '',
        isInAnchorMode ? 'bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800' : ''
      )}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      draggable={!isInAnchorMode} // 锚定模式下禁用拖拽
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* 拖拽手柄 - 对不同块类型使用不同位置，锚定模式下隐藏 */}
      {!isInAnchorMode && (
      <div className={cn(
        "absolute flex items-center justify-center opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity",
        block.block_type === 'audio_aligned' 
          ? "left-2 top-3 w-8 h-8" 
          : "left-0 top-0.5 w-8 h-8"
      )}>
        <DragHandleDots2Icon className="h-6 w-6 text-muted-foreground cursor-grab" />
      </div>
      )}
      
      {/* 块内容 */}
      <div className={cn(
        isInAnchorMode ? 'pl-0' : 'pl-6' // 锚定模式下不需要左内边距
      )}>
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