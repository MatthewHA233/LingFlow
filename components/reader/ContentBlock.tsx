import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import { Play, Pause, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextAlignmentService } from '@/lib/services/text-alignment';
import { supabase } from '@/lib/supabase-client';
import { toast } from '@/hooks/use-toast';
import Image from 'next/image';
import { AudioController, AUDIO_EVENTS } from '@/lib/audio-controller';

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
}

// 创建一个自定义事件名称
const CLEAR_ACTIVE_SENTENCE_EVENT = 'clear-active-sentences';

// 添加全局音频管理
const AUDIO_CONTROLLER_EVENT = 'global-audio-control';

// 创建统一的音频控制系统 
// 添加在文件顶部与其他常量一起
const AUDIO_STATE_EVENT = 'audio-state-update';
const AUDIO_TIME_EVENT = 'audio-time-update';

// 在文件开头添加全局音频实例管理
// 确保整个应用中只有一个活动的音频实例
let GLOBAL_AUDIO_INSTANCE: HTMLAudioElement | null = null;
const AUDIO_BLOCKER_TIMEOUT = 50; // 毫秒
let isAudioBlocked = false;

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
  onPlayModeChange
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
  
  const blockRef = useRef<HTMLDivElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  
  // 创建唯一ID用于标识当前块
  const blockId = useId();

  // 添加解析和加载嵌入式句子的函数 - 保持在组件顶部
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

  // 1. 先定义playSentence函数
  const playSentence = useCallback((sentence: any, index: number) => {
    // 发送清除其他活动句子的事件
    const clearEvent = new CustomEvent(CLEAR_ACTIVE_SENTENCE_EVENT, {
      detail: { senderId: blockId }
    });
    window.dispatchEvent(clearEvent);
    
    // 如果正在播放同一个句子，则暂停
    if (activeIndex === index && isPlaying) {
      // 暂停当前播放
      AudioController.pause();
      setIsPlaying(false);
      return;
    }
    
    // 设置当前活动句子
    setActiveIndex(index);
    
    // 检查是否有句子音频数据
    if (!sentence || !audioUrl) {
      console.error('无法播放：句子数据或音频URL缺失');
      return;
    }
    
    // 获取音频信息
    const beginTime = sentence.begin_time;
    const endTime = sentence.end_time;
    
    // 播放功能
    const playbackCallback = () => {
      console.log('句子播放结束');
      
      // 处理循环模式
      if (playMode === 'sentence') {
        // 句子循环 - 重播同一句子
        setTimeout(() => {
          console.log('重播句子', index);
          setIsReplaying(true);
          AudioController.play(audioUrl, beginTime, endTime, `block-${block.id}`, () => {
            setIsReplaying(false);
          });
        }, 500); // 短暂延迟后重播
      } else {
        // 提取所有句子ID
        const sentenceIds: string[] = [];
        const pattern = /\[\[([a-f0-9-]+)\]\]/g;
        let match;
        const content = block.content || '';
        while ((match = pattern.exec(content)) !== null) {
          sentenceIds.push(match[1]);
        }
        
        // 判断是否是最后一句
        const isLastSentence = index >= sentenceIds.length - 1;
        
        if ((playMode === 'block' || playMode === 'continuous') && !isLastSentence) {
          // 段落内下一句 - 播放下一个句子
          setTimeout(() => {
            console.log('播放下一句', index + 1);
            
            // 检查是否有下一个句子
            if (index + 1 < sentenceIds.length) {
              const nextSentenceId = sentenceIds[index + 1];
              const nextSentence = embeddedSentences.get(nextSentenceId);
              if (nextSentence) {
                playSentence(nextSentence, index + 1);
              }
            }
          }, 500);
        } else if (playMode === 'continuous' && isLastSentence) {
          // 连续模式下的最后一句 - 播放下一个块
          setTimeout(() => {
            console.log('播放下一个块');
            onPlayNext?.(block.id, index);
          }, 500);
        }
      }
    };
    
    // 使用全局音频控制器播放
    AudioController.play(audioUrl, beginTime, endTime, `block-${block.id}`, playbackCallback);
    setIsPlaying(true);
    
    // 更新时间显示
    onTimeChange?.(beginTime);
  }, [activeIndex, isPlaying, blockId, audioUrl, block.id, block.content, embeddedSentences, onPlayNext, onTimeChange, playMode]);

  // 2. 然后是其他函数和useEffect，保持原有顺序
  useEffect(() => {
    parseAndLoadEmbeddedSentences();
  }, [parseAndLoadEmbeddedSentences]);
  
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

  // 添加一个事件监听器来清除活动句子
  useEffect(() => {
    // 当收到清除事件且不是发送者时，清除自己的活动状态
    const handleClearActive = (e: CustomEvent) => {
      const senderId = e.detail?.senderId;
      if (senderId !== blockId) {
        setActiveIndex(null);
        setIsPlaying(false);
      }
    };
    
    // 添加事件监听器
    window.addEventListener(
      CLEAR_ACTIVE_SENTENCE_EVENT, 
      handleClearActive as EventListener
    );
    
    return () => {
      window.removeEventListener(
        CLEAR_ACTIVE_SENTENCE_EVENT, 
        handleClearActive as EventListener
      );
    };
  }, [blockId]);

  // 在ContentBlock组件中添加音频结束事件监听
  useEffect(() => {
    // 音频播放结束处理函数
    const handleAudioEnded = () => {
      setIsPlaying(false);
      setActiveIndex(null);
    };
    
    // 添加事件监听
    window.addEventListener('audio-playback-ended', handleAudioEnded);
    
    return () => {
      window.removeEventListener('audio-playback-ended', handleAudioEnded);
    };
  }, []);

  // 添加音频状态变更事件监听
  useEffect(() => {
    const handleAudioStateChange = (e: CustomEvent) => {
      const detail = e.detail;
      // 只处理不是自己发送的状态变更
      if (detail.sender !== 'contentBlock') {
        setIsPlaying(detail.isPlaying);
      }
    };
    
    window.addEventListener('audio-state-change', handleAudioStateChange as EventListener);
    
    return () => {
      window.removeEventListener('audio-state-change', handleAudioStateChange as EventListener);
    };
  }, []);

  // 添加全局音频控制监听
  useEffect(() => {
    const handleGlobalAudioControl = (e: CustomEvent) => {
      const { action, sender } = e.detail;
      
      // 如果不是自己发送的停止指令，则暂停自己的音频
      if (action === 'stop-all' && sender !== blockId && GLOBAL_AUDIO_INSTANCE) {
        GLOBAL_AUDIO_INSTANCE.pause();
        setIsPlaying(false);
        setActiveIndex(null);
      }
    };
    
    window.addEventListener(AUDIO_CONTROLLER_EVENT, handleGlobalAudioControl as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_CONTROLLER_EVENT, handleGlobalAudioControl as EventListener);
    };
  }, [blockId]);

  // 添加音频时间更新监听，更新UI
  useEffect(() => {
    const handleTimeUpdate = (e: CustomEvent) => {
      const { currentTime, playerId } = e.detail;
      
      // 检查是否是单词播放器ID
      const isWordPlayer = playerId && playerId.includes('-word-');
      
      // 更新当前时间
      setCurrentAudioTime(currentTime);
      
      // 如果是单词播放，不要触发句子高亮
      if (!isWordPlayer && playerId && (
        playerId.startsWith(`block-${block.id}`) || 
        playerId === 'main-audio-player'
      )) {
        // 只在句子播放时更新活动句子
        if (activeIndex === null) {
          // 查找当前时间所在的句子
          const matchingSentenceIndex = embeddedSentences.size > 0 ? 0 : -1;
          
          if (matchingSentenceIndex !== -1) {
            setActiveIndex(matchingSentenceIndex);
          }
        }
      }
      
      // 总是传递时间给父组件
      onTimeChange?.(currentTime);
    };
    
    if (GLOBAL_AUDIO_INSTANCE) {
      GLOBAL_AUDIO_INSTANCE.addEventListener('timeupdate', handleTimeUpdate);
      
      return () => {
        if (GLOBAL_AUDIO_INSTANCE) {
          GLOBAL_AUDIO_INSTANCE.removeEventListener('timeupdate', handleTimeUpdate);
        }
      };
    }
  }, [block.id, onTimeChange]);

  // 添加全局音频状态监听
  useEffect(() => {
    // 监听全局音频状态更新
    const handleAudioState = (e: CustomEvent) => {
      const { isPlaying, blockId: stateBlockId, sentenceIndex, sender } = e.detail;
      
      // 如果状态变更不是由本组件发送的
      if (sender !== blockId) {
        // 如果状态更新与当前块相关
        if (stateBlockId === block.id) {
          setIsPlaying(isPlaying);
          setActiveIndex(sentenceIndex);
        } else {
          // 如果与当前块无关，则重置状态
          setIsPlaying(false);
          setActiveIndex(null);
        }
      }
    };
    
    window.addEventListener(AUDIO_STATE_EVENT, handleAudioState as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_STATE_EVENT, handleAudioState as EventListener);
    };
  }, [block.id, blockId]);

  // 监听全局音频时间更新
  useEffect(() => {
    const handleAudioTimeUpdate = (e: CustomEvent) => {
      const { currentTime, blockId: timeBlockId, sentenceIndex } = e.detail;
      
      // 只处理与当前块相关的时间更新
      if (timeBlockId === block.id && activeIndex === sentenceIndex) {
        // 找到当前应该高亮的单词
        if (embeddedSentences.size > 0) {
          const words = embeddedSentences.values().next().value.words;
          
          // 遍历单词，找到当前时间点对应的单词
          for (const word of words) {
            if (currentTime >= word.begin_time && currentTime < word.end_time) {
              // 找到了当前单词，强制更新UI
              setIsPlaying(prev => prev);
              break;
            }
          }
        }
      }
    };
    
    window.addEventListener(AUDIO_TIME_EVENT, handleAudioTimeUpdate as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_TIME_EVENT, handleAudioTimeUpdate as EventListener);
    };
  }, [block.id, activeIndex, embeddedSentences]);

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
    setIsDragging(true);
    e.dataTransfer.setData('blockId', block.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // 处理拖拽悬停
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    
    // 确保Firefox可以正确获取数据
    if (e.dataTransfer.types.includes('application/json')) {
      // 这是句子拖拽，整个块高亮
      setIsDragOver(true);
      setDropPosition(null); // 不需要位置指示器
      return;
    }
    
    // 这是块拖拽，显示位置指示器
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
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      // 如果是块排序
      if (data.type === 'block' && onOrderChange) {
        const position = getDropPosition(e);
        onOrderChange(data.id, block.id, position);
        return;
      }
      
      // 如果是语音识别句子对齐
      if (data.type === 'sentence' && block.block_type === 'text') {
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
          // 让动画继续播放一段时间
          // 实际对齐完成后，动画效果会在useEffect中自动处理
        } else {
          // 立即结束对齐状态
          setLocalAligning(false);
          toast({
            title: "对齐失败",
            description: result.message || "文本对齐处理失败",
            variant: "destructive",
          });
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

  // 减少事件监听数量
  useEffect(() => {
    // 只监听状态变更
    const handleStateChange = (e: CustomEvent) => {
      const { isPlaying: newIsPlaying, playerId } = e.detail;
      
      // 检查是否与当前块相关
      if (playerId && playerId.startsWith(`block-${block.id}`)) {
        setIsPlaying(newIsPlaying);
        
        // 如果停止播放且不是单词播放，重置活动句子
        if (!newIsPlaying && !playerId.includes('-word-')) {
          setActiveIndex(null);
        }
      } else if (playerId !== null) {
        // 其他块在播放，重置自己的状态
        setIsPlaying(false);
        setActiveIndex(null);
      }
    };
    
    // 监听时间更新，但减少处理逻辑
    const handleTimeUpdate = (e: CustomEvent) => {
      const { currentTime, playerId } = e.detail;
      
      // 只更新与自己相关的时间
      if (playerId && playerId.startsWith(`block-${block.id}`)) {
        setCurrentAudioTime(currentTime);
        onTimeChange?.(currentTime);
      }
    };
    
    window.addEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
    window.addEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    
    // 页面加载时紧急清理
    AudioController.emergencyCleanup();
    
    return () => {
      window.removeEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
      window.removeEventListener(AUDIO_EVENTS.TIME_UPDATE, handleTimeUpdate as EventListener);
    };
  }, [block.id, onTimeChange]);

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
        
        // 添加可点击单词
        elements.push(
          <span 
            key={`word-${sentenceIndex}-${word.id}`}
            className={cn(
              "cursor-pointer rounded-sm px-0.5",
              isWordActiveResult 
                ? "text-emerald-500 font-medium" 
                : "hover:text-emerald-400"
            )}
            onClick={(e) => {
              e.stopPropagation();
              playWord(word, e);
            }}
          >
            {wordContent}
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

  // 渲染内容
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
    
    // 音频对齐块 - 使用新的渲染方式
    if (block.block_type === 'audio_aligned') {
      return (
        <div className="audio-aligned-block py-2 px-3 text-sm leading-relaxed">
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
      {/* 拖拽手柄 - 悬停时显示 */}
      <div className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity">
        <DragHandleDots2Icon className="h-4 w-4 text-muted-foreground cursor-grab" />
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