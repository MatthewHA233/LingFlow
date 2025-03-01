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
  const [alignedSentences, setAlignedSentences] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localAligning, setLocalAligning] = useState(isAligning);
  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  
  const blockRef = useRef<HTMLDivElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  
  // 创建唯一ID用于标识当前块
  const blockId = useId();

  const fetchAlignedSentences = useCallback(async () => {
    if (block.block_type === 'audio_aligned' && block.speech_id) {
      try {
        const { data: blockSentences, error: blockSentencesError } = await supabase
          .from('block_sentences')
          .select(`
            *,
            sentences (*, words (*))
          `)
          .eq('block_id', block.id)
          .order('order_index');
          
        if (blockSentencesError) throw blockSentencesError;
        
        if (blockSentences && blockSentences.length > 0) {
          const sentences = blockSentences.map((bs: any) => ({
            ...bs.sentences,
            order_index: bs.order_index
          }));
          
          setAlignedSentences(sentences);
        }
      } catch (error) {
        console.error('加载对齐句子失败:', error);
      }
    }
  }, [block.id, block.block_type, block.speech_id]);

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
          
          fetchAlignedSentences();
        }, 1500);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [localAligning, block.id, onAlignmentComplete, fetchAlignedSentences]);

  useEffect(() => {
    fetchAlignedSentences();
  }, [block.id, block.block_type, block.speech_id, fetchAlignedSentences]);

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

  // 添加事件监听器以接收播放指令
  useEffect(() => {
    const handlePlayBlockSentence = (e: CustomEvent) => {
      const detail = e.detail;
      
      if (detail.blockId === block.id && alignedSentences.length > 0) {
        // 确保句子索引有效
        const sentenceIndex = Math.min(detail.sentenceIndex, alignedSentences.length - 1);
        
        // 播放指定的句子
        if (sentenceIndex >= 0 && sentenceIndex < alignedSentences.length) {
          playSentence(alignedSentences[sentenceIndex], sentenceIndex);
        }
      }
    };
    
    window.addEventListener('play-block-sentence', handlePlayBlockSentence as EventListener);
    
    return () => {
      window.removeEventListener('play-block-sentence', handlePlayBlockSentence as EventListener);
    };
  }, [alignedSentences, block.id]);

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
    const handleTimeUpdate = (e: Event) => {
      const audioElement = e.target as HTMLAudioElement;
      const currentTime = audioElement.currentTime;
      
      // 构建与自定义事件相同格式的数据结构
      const detail = {
        currentTime,
        playerId: 'main-audio-player'
      };
      
      // 更新当前时间
      setCurrentAudioTime(currentTime);
      
      // 查找当前时间所在的句子
      const matchingSentenceIndex = alignedSentences.findIndex(
        sentence => currentTime >= sentence.begin_time && currentTime < sentence.end_time
      );
      
      if (matchingSentenceIndex !== -1 && activeIndex === null) {
        setActiveIndex(matchingSentenceIndex);
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
  }, [alignedSentences, activeIndex, onTimeChange]);

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
        if (alignedSentences[sentenceIndex]?.words) {
          const words = alignedSentences[sentenceIndex].words;
          
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
  }, [block.id, activeIndex, alignedSentences]);

  // 添加对play-block事件的监听
  useEffect(() => {
    // 监听播放指令
    const handlePlayBlockEvent = (e: CustomEvent) => {
      const { blockId, index } = e.detail;
      if (blockId === block.id && alignedSentences.length > 0) {
        console.log('收到播放指令', blockId, index);
        
        // 确保索引有效
        const sentenceIndex = index >= 0 && index < alignedSentences.length ? index : 0;
        
        // 延迟一点时间再播放，确保UI已经更新
        setTimeout(() => {
          playSentence(alignedSentences[sentenceIndex], sentenceIndex);
        }, 200);
      }
    };
    
    window.addEventListener('play-block', handlePlayBlockEvent as EventListener);
    
    return () => {
      window.removeEventListener('play-block', handlePlayBlockEvent as EventListener);
    };
  }, [block.id, alignedSentences]);

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
    e.dataTransfer.setData('text/plain', block.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    setIsDragging(false);
    setDropPosition(null);
  };

  // 处理拖拽悬停
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const rect = blockRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseY = e.clientY;
      const threshold = rect.top + (rect.height / 3);
      setDropPosition(mouseY < threshold ? 'before' : 'after');
    }
  };

  // 离开拖拽区域
  const handleDragLeave = () => {
    setDropPosition(null);
  };

  // 处理拖放
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId !== block.id && dropPosition) {
      onOrderChange?.(draggedId, block.id, dropPosition);
    }
    setDropPosition(null);
  };

  // 修改句子播放函数
  const playSentence = (sentence: any, index: number) => {
    // 如果已经在播放这个句子，则暂停
    if (activeIndex === index && isPlaying) {
      AudioController.pause();
      return;
    }
    
    // 播放新句子
    AudioController.play(
      audioUrl || '',
      sentence.begin_time, // 开始时间
      null, // 不使用结束时间控制，由其他事件处理
      `block-${block.id}-sentence-${index}`
    ).then((wasPlaying: boolean) => {
      // 播放成功后更新UI状态
      if (wasPlaying) {
        setActiveIndex(index);
        setIsPlaying(true);
        
        // 如果有结束时间，设置定时器在句子结束时触发
        if (sentence.end_time && sentence.begin_time < sentence.end_time) {
          // 计算持续时间（毫秒）
          const duration = sentence.end_time - sentence.begin_time;
          
          // 设置定时器
          setTimeout(() => {
            // 句子播放完成
            console.log('句子播放完成', index);
            handleSentencePlayComplete(index);
          }, duration);
        }
      }
    });
  };

  // 简化单词播放函数
  const playWord = (word: any, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // 暂停所有正在播放的内容
    AudioController.pause();
    
    // 标记单词为活动状态
    setActiveWordId(word.id);
    
    // 播放单词 - 调整参数数量
    AudioController.play(
      audioUrl || '',
      word.begin_time,
      word.end_time,
      `block-${block.id}-word-${word.id}`
    );
    
    // 设置单独的回调
    AudioController.setOnEndCallback(() => setActiveWordId(null));
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
    
    // 音频对齐块
    if (block.block_type === 'audio_aligned' && alignedSentences.length > 0) {
      return (
        <div className="audio-aligned-block py-2 px-3 text-sm leading-relaxed">
          {/* 紧凑排版的句子流 */}
          <div className="prose prose-sm max-w-none">
            {alignedSentences.map((sentence, index) => (
              <span 
                key={sentence.id}
                className={cn(
                  "sentence-inline relative rounded-sm px-0.5 mx-0.5 transition-colors cursor-pointer",
                  activeIndex === index 
                    ? "text-emerald-500 font-medium"
                    : "hover:bg-accent/10 group"
                )}
                onClick={() => playSentence(sentence, index)}
              >
                {/* 微型播放图标 */}
                <span className={cn(
                  "inline-flex items-center justify-center w-3 h-3 mr-0.5 align-text-bottom rounded-full",
                  activeIndex === index && isPlaying
                    ? "bg-emerald-100" 
                    : "bg-transparent group-hover:bg-accent/5"
                )}>
                  {activeIndex === index && isPlaying ? (
                    <Pause className="w-2 h-2 text-emerald-600" />
                  ) : (
                    <Play className="w-2 h-2 text-muted-foreground opacity-50 group-hover:opacity-100" />
                  )}
                </span>
                
                {renderSentenceWithWords(sentence, index)}
              </span>
            ))}
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
            {block.content}
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

  // 添加句子播放完成处理函数
  const handleSentencePlayComplete = (index: number) => {
    // 如果正在重播中，不要触发新的重播
    if (isReplaying) return;
    
    // 防止重入
    setIsReplaying(true);
    
    // 根据播放模式决定下一步操作
    switch (playMode) {
      case 'sentence':
        // 重复播放当前句子
        setTimeout(() => {
          playSentence(alignedSentences[index], index);
          setTimeout(() => setIsReplaying(false), 500);
        }, 300);
        break;
        
      case 'block':
        // 播放整个块
        setTimeout(() => {
          if (index < alignedSentences.length - 1) {
            playSentence(alignedSentences[index + 1], index + 1);
          } else {
            playSentence(alignedSentences[0], 0);
          }
          setTimeout(() => setIsReplaying(false), 500);
        }, 300);
        break;
        
      case 'continuous':
        // 连续播放
        setTimeout(() => {
          if (index < alignedSentences.length - 1) {
            playSentence(alignedSentences[index + 1], index + 1);
          } else {
            // 播放下一个块
            onPlayNext?.(block.id, index);
          }
          setTimeout(() => setIsReplaying(false), 500);
        }, 300);
        break;
        
      default:
        setIsReplaying(false);
        break;
    }
  };

  return (
    <div
      ref={blockRef}
      className={cn(
        'group relative my-1 p-2 rounded-md transition-all duration-300',
        isSelected ? 'bg-accent/20 border border-primary/30' : 'hover:bg-accent/10 border border-transparent',
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