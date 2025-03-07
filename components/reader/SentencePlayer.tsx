'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { supabase } from '@/lib/supabase-client';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from 'react-beautiful-dnd';
import { debounce } from 'lodash';
import { Play, Pause, GripVertical, AlignCenter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { formatTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { AudioController, AUDIO_EVENTS } from '@/lib/audio-controller';
import { useInView } from 'react-intersection-observer';
import { Pagination } from '@/components/ui/pagination';
import { motion } from 'framer-motion';
import {
  Toast,
  ToastTitle,
  ToastProvider,
  ToastViewport,
} from '@/components/ui/toast';

interface Word {
  id: string;
  sentence_id: string;
  word: string;
  begin_time: number;
  end_time: number;
}

interface Sentence {
  id: string;
  speech_id: string;
  text_content: string;
  begin_time: number;
  end_time: number;
  speech_rate?: number;
  emotion_value?: number;
  order: number;
  words: Word[];
  conversion_status?: string;
}

interface SentencePlayerProps {
  speechId: string;
  onTimeChange: (time: number) => void;
  currentTime?: number;
  isAlignMode?: boolean;
  onToggleAlignMode?: () => void;
  disabled?: boolean;
}

// 添加 PlayMode 类型定义
type PlayMode = 'sentence' | 'block' | 'continuous';

export function SentencePlayer({ speechId, onTimeChange, currentTime = 0, isAlignMode = false, onToggleAlignMode, disabled = false }: SentencePlayerProps) {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10; // 每页显示10条
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(-1);
  const lastClickTimeRef = useRef<number>(0);
  const MIN_CLICK_INTERVAL = 200;
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [playingStates, setPlayingStates] = useState<{[key: string]: boolean}>({});
  const [activeWordIndices, setActiveWordIndices] = useState<{[key: string]: number | null}>({});
  const [hideAligned, setHideAligned] = useState(false);
  const [aligningIds, setAligningIds] = useState<Set<string>>(new Set());
  const [alignmentCompleted, setAlignmentCompleted] = useState<Set<string>>(new Set());
  const [hasShownPlayModeNotice, setHasShownPlayModeNotice] = useState(false);

  // 加载句子数据
  const loadSentences = useCallback(async (page: number) => {
    if (!speechId) return;
    
    try {
      setLoading(true);
      
      // 先获取总数
      const { count } = await supabase
        .from('sentences')
        .select('*', { count: 'exact', head: true })
        .eq('speech_id', speechId);
        
      setTotalPages(Math.ceil((count || 0) / pageSize));
      
      // 获取当前页数据，包括关联的 words 数据
      const { data, error } = await supabase
        .from('sentences')
        .select(`
          *,
          words (
            id,
            word,
            begin_time,
            end_time,
            sentence_id
          )
        `)
        .eq('speech_id', speechId)
        .order('order', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw error;

      // 确保 words 数组按时间排序
      const sortedData = data?.map(sentence => ({
        ...sentence,
        words: sentence.words.sort((a, b) => a.begin_time - b.begin_time)
      }));

      setSentences(sortedData || []);
    } catch (err) {
      console.error('加载句子失败:', err);
      setError('加载句子失败');
    } finally {
      setLoading(false);
    }
  }, [speechId]);

  // 页码变化时重新加载
  useEffect(() => {
    loadSentences(currentPage);
  }, [currentPage, loadSentences]);

  // 计算单词的播放进度
  const getWordProgress = useCallback((word: Word, currentTime: number) => {
    if (!currentTime) return 0;
    if (currentTime < word.begin_time) return 0;
    if (currentTime > word.end_time) return 100;
    return ((currentTime - word.begin_time) / (word.end_time - word.begin_time)) * 100;
  }, []);

  // 优化单词点击处理
  const handleWordClick = useCallback((word: Word, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const now = Date.now();
    // 确保两次点击之间有足够的间隔
    if (now - lastClickTimeRef.current < MIN_CLICK_INTERVAL) {
      console.log('点击过于频繁，忽略本次点击');
      return;
    }
    
    // 更新最后点击时间
    lastClickTimeRef.current = now;
    
    // 确保时间有效
    if (word.begin_time >= 0) {
      console.log('点击单词，跳转到时间:', word.begin_time, word.word);
      // 使用 requestAnimationFrame 确保状态更新和 UI 渲染同步
      requestAnimationFrame(() => {
        onTimeChange(word.begin_time);
      });
    }
  }, [onTimeChange]);

  // 优化句子点击处理
  const handleSentenceClick = useCallback((sentence: Sentence) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < MIN_CLICK_INTERVAL) {
      console.log('点击过于频繁，忽略本次点击');
      return;
    }
    
    lastClickTimeRef.current = now;
    
    // 确保时间有效
    if (sentence.begin_time >= 0) {
      console.log('点击句子，跳转到时间:', sentence.begin_time);
      requestAnimationFrame(() => {
        onTimeChange(sentence.begin_time);
      });
    }
  }, [onTimeChange]);

  // 处理句子文本，提取标点符号
  const renderSentenceContent = useCallback((sentence: Sentence, currentTime: number) => {
    const textContent = sentence.text_content;
    const words = sentence.words;
    const result: (Word | string)[] = [];
    
    let currentPosition = 0;
    words.forEach(word => {
      const wordIndex = textContent.indexOf(word.word, currentPosition);
      if (wordIndex > currentPosition) {
        result.push(textContent.slice(currentPosition, wordIndex));
      }
      result.push(word);
      currentPosition = wordIndex + word.word.length;
    });
    
    if (currentPosition < textContent.length) {
      result.push(textContent.slice(currentPosition));
    }
    
    return result;
  }, []);

  // 使用 memo 优化句子渲染
  const SentenceItem = memo(({ 
    sentence, 
    isActive, 
    currentTime,
    onSentenceClick,
    onWordClick,
    isAligned 
  }: { 
    sentence: Sentence;
    isActive: boolean;
    currentTime: number;
    onSentenceClick: (sentence: Sentence) => void;
    onWordClick: (word: Word, e: React.MouseEvent) => void;
    isAligned?: boolean;
  }) => {
    const sentenceContent = useMemo(() => 
      renderSentenceContent(sentence, currentTime),
      [sentence, currentTime, renderSentenceContent]
    );

    return (
      <div
        className={`py-0.5 px-1 rounded-sm transition-colors ${
          isActive ? 'bg-accent/30' : 'hover:bg-accent/20'
        }`}
        onClick={() => onSentenceClick(sentence)}
      >
        <div className="pl-2">
          {isActive && (
            <div className="mb-0.5">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-[9px] text-muted-foreground">
                  {formatTime(sentence.begin_time)} - {formatTime(sentence.end_time)}
                </span>
                <div className="text-[9px] text-muted-foreground flex flex-wrap items-center gap-1">
                  {sentence.speech_rate && (
                    <span>语速:{Math.round(sentence.speech_rate)}字/分</span>
                  )}
                  {sentence.emotion_value && (
                    <span>情感:{sentence.emotion_value.toFixed(1)}</span>
                  )}
                  {isAligned && <span className="text-emerald-500">已对齐</span>}
                </div>
              </div>
            </div>
          )}
          <div className="text-xs leading-4">
            {sentenceContent.map((item, idx) => {
              if (typeof item === 'string') {
                return <span key={idx} className="text-muted-foreground">{item}</span>;
              } else {
                const progress = getWordProgress(item, currentTime);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="inline-block px-1 rounded hover:bg-primary/10 cursor-pointer transition-colors relative focus:outline-none focus:ring-1 focus:ring-primary active:bg-primary/20"
                    onClick={(e) => onWordClick(item, e)}
                    title={`点击播放: ${item.word}`}
                  >
                    <span className="relative z-10">{item.word}</span>
                    <span 
                      className="absolute inset-0 bg-primary/20 rounded transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  </button>
                );
              }
            })}
          </div>
        </div>
      </div>
    );
  });

  // 添加 displayName
  SentenceItem.displayName = 'SentenceItem';

  // 添加拖拽处理函数
  const handleDragStart = (e: React.DragEvent, sentence: Sentence) => {
    try {
      // 设置句子数据
      const data = JSON.stringify({
        type: 'sentence',
        speechId: speechId,
        sentenceId: sentence.id,
        text: sentence.text_content
      });
      e.dataTransfer.setData('application/json', data);
      
      // 添加标识类型 - 这是关键!
      e.dataTransfer.setData('sentence-align-drag', 'true');
      
      // 创建拖拽预览效果
      const dragPreview = document.createElement('div');
      dragPreview.classList.add('sentence-drag-preview');
      dragPreview.textContent = sentence.text_content;
      dragPreview.style.position = 'absolute';
      dragPreview.style.left = '-9999px';
      document.body.appendChild(dragPreview);
      e.dataTransfer.setDragImage(dragPreview, 0, 0);
      
      // 添加样式
      e.currentTarget.classList.add('opacity-50');
      
      setTimeout(() => {
        document.body.removeChild(dragPreview);
      }, 0);
    } catch (err) {
      console.error('设置拖拽数据失败:', err);
    }
  };
  
  const handleDragEnd = async (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-50');
    const sentenceId = e.currentTarget.getAttribute('data-sentence-id');
    
    if (!sentenceId) return;

    try {
      // 1. 获取当前句子的时间戳作为参考点
      const { data: targetSentence } = await supabase
        .from('sentences')
        .select('begin_time')
        .eq('id', sentenceId)
        .single();

      if (!targetSentence) return;

      // 2. 获取从这个时间戳开始的所有句子
      const { data: consecutiveSentences } = await supabase
        .from('sentences')
        .select('id')
        .eq('speech_id', speechId)
        .gte('begin_time', targetSentence.begin_time)
        .order('begin_time');

      if (!consecutiveSentences) return;

      // 3. 设置所有相关句子为对齐中状态
      const aligningIdSet = new Set(consecutiveSentences.map(s => s.id));
      setAligningIds(aligningIdSet);

      // 4. 等待一段时间让对齐操作开始
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 5. 开始检查对齐状态
      const checkAlignmentStatus = async () => {
        const { data: updatedSentences } = await supabase
          .from('sentences')
          .select(`
            id,
            conversion_status,
            text_content,
            words (
              id,
              word,
              begin_time,
              end_time,
              sentence_id
            )
          `)
          .in('id', Array.from(aligningIdSet));

        if (!updatedSentences) return false;

        // 检查是否所有句子都已完成对齐
        const allCompleted = updatedSentences.every(
          s => s.conversion_status === 'converted'
        );

        if (allCompleted) {
          // 更新本地状态
          const completedIds = new Set(updatedSentences.map(s => s.id));
          setAlignmentCompleted(completedIds);

          // 更新句子数据
          setSentences(prev => 
            prev.map(s => {
              const updated = updatedSentences.find(us => us.id === s.id);
              if (updated) {
                return {
                  ...s,
                  ...updated,
                  words: updated.words.sort((a: any, b: any) => 
                    a.begin_time - b.begin_time
                  )
                };
              }
              return s;
            })
          );

          // 延迟清除对齐状态
          setTimeout(() => {
            setAligningIds(new Set());
            setAlignmentCompleted(new Set());
          }, 2000);

          return true;
        }

        return false;
      };

      // 开始轮询检查对齐状态，增加初始延迟和检查间隔
      let attempts = 0;
      const maxAttempts = 20; // 最多尝试20次
      
      const pollInterval = setInterval(async () => {
        attempts++;
        const completed = await checkAlignmentStatus();
        
        if (completed || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (!completed) {
            // 如果超时未完成，清除对齐状态
            setAligningIds(new Set());
            console.log('对齐超时或未完成');
          }
        }
      }, 1000); // 每秒检查一次

      // 设置超时保护
      setTimeout(() => {
        clearInterval(pollInterval);
        setAligningIds(new Set());
      }, 20000); // 20秒超时

    } catch (err) {
      console.error('对齐处理失败:', err);
      setAligningIds(new Set());
    }
  };

  // 修改togglePlay函数
  const togglePlay = () => {
    // 确保有活动句子
    if (!activeSentenceId || !sentences.length) return;
    
    // 找到活动句子
    const activeSentence = sentences.find(s => s.id === activeSentenceId);
    if (!activeSentence) return;
    
    const playerId = `sentence-${activeSentenceId}`;
    
    // 播放音频
    const isPlayStarted = AudioController.play(
      audioUrl,
      activeSentence.begin_time,
      activeSentence.end_time,
      playerId
    );
    
    // 更新状态
    setPlayingStates({ [playerId]: isPlayStarted });
  };

  // 添加状态监听
  useEffect(() => {
    // 监听音频状态变更
    const handleStateChange = (e: CustomEvent) => {
      const { isPlaying: newIsPlaying, playerId } = e.detail;
      
      // 检查播放器ID是否与当前活动句子相关
      if (playerId && playerId.startsWith('sentence-') && activeSentenceId) {
        const sentenceIdFromPlayer = playerId.replace('sentence-', '');
        
        // 如果状态变更与当前活动句子相关
        if (sentenceIdFromPlayer === activeSentenceId) {
          setPlayingStates({ [playerId]: newIsPlaying });
          
          // 如果开始播放，重置活动单词索引
          if (newIsPlaying) {
            setActiveSentenceIndex(null);
          }
        } else {
          // 如果与其他句子相关，重置自己的状态
          setPlayingStates({ [playerId]: false });
          setActiveSentenceIndex(null);
        }
      }
    };
    
    window.addEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
    };
  }, [activeSentenceId]); // 使用activeSentenceId而不是sentence.id

  // 修改SentencePlayer中的相关部分
  useEffect(() => {
    // 添加监听器来接收"仅未对齐"按钮的点击事件
    const handleToggleHideAligned = () => {
      // Implementation of handleToggleHideAligned function
    };
    
    window.addEventListener('toggle-hide-aligned', handleToggleHideAligned);
    
    return () => {
      window.removeEventListener('toggle-hide-aligned', handleToggleHideAligned);
    };
  }, []);

  // 修改初始化逻辑，添加disabled检查
  useEffect(() => {
    // 如果被禁用，跳过初始化
    if (disabled) return;
    
    // 只有当speechId存在且数据有效时初始化
    if (speechId && sentences.length > 0) {
      // 设置默认播放模式
      AudioController.setPlayMode('continuous');
      
      // 其余初始化代码...
    }
  }, [speechId, sentences.length, disabled]);

  // 修改播放模式变更处理
  const handlePlayModeChange = (newMode: PlayMode) => {
    AudioController.setPlayMode(newMode);
    
    // 只在第一次改变时显示提示
    if (!hasShownPlayModeNotice) {
      // 创建并显示 toast
      const toastElement = document.createElement('div');
      toastElement.innerHTML = `
        <div class="fixed bottom-4 right-4 z-50">
          <div class="bg-background border rounded-lg shadow-lg p-4 flex items-center gap-2">
            <span class="text-sm">${newMode === 'sentence' ? '句子播放模式' : newMode === 'block' ? '块播放模式' : '连续播放模式'}</span>
          </div>
        </div>
      `;
      document.body.appendChild(toastElement);
      
      // 3秒后移除
      setTimeout(() => {
        toastElement.remove();
      }, 3000);
      
      setHasShownPlayModeNotice(true);
    }
  };

  // 添加状态指示器的颜色映射
  const statusColors = {
    none: 'bg-red-500',
    converted: 'bg-emerald-500',
    reverted: 'bg-yellow-500'
  } as const;

  if (disabled) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (loading && currentPage === 1) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  if (error && sentences.length === 0) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <>
      <ToastProvider>
        <div className="flex flex-col h-[calc(100vh-12rem)]">
          {/* 句子列表容器 */}
          <div className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/30">
            <div className="space-y-0.5 p-1">
              {sentences.map((sentence) => {
                if (hideAligned && sentence.conversion_status === 'converted') {
                  return null;
                }

                const isAligning = aligningIds.has(sentence.id);
                const isCompleted = alignmentCompleted.has(sentence.id);

                return (
                  <motion.div
                    key={sentence.id}
                    data-sentence-id={sentence.id}
                    className={cn(
                      'relative p-1 rounded-sm border shadow-sm',
                      sentence.conversion_status === 'converted' ? 'bg-emerald-950/10' : 'bg-card',
                      activeSentenceId === sentence.id ? 'border-primary' : 'border-border',
                      'cursor-grab active:cursor-grabbing',
                      isAligning && 'animate-pulse',
                      isCompleted && 'alignment-complete'
                    )}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, sentence)}
                    onDragEnd={handleDragEnd}
                    animate={{
                      scale: isAligning ? 1.02 : 1,
                      transition: { duration: 0.2 }
                    }}
                  >
                    {/* 状态指示器灯 */}
                    <div 
                      className={cn(
                        "absolute right-1 top-1 w-2 h-2 rounded-full",
                        statusColors[sentence.conversion_status || 'none']
                      )}
                      title={`状态: ${
                        sentence.conversion_status === 'converted' ? '已对齐' :
                        sentence.conversion_status === 'reverted' ? '已回撤' :
                        '未对齐'
                      }`}
                    />

                    {/* 拖拽手柄 */}
                    <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-4 opacity-40 group-hover:opacity-100">
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                    </div>

                    <div className="pl-4">
                      <SentenceItem
                        sentence={sentence}
                        isActive={activeSentenceIndex === sentences.indexOf(sentence)}
                        currentTime={currentTime}
                        onSentenceClick={handleSentenceClick}
                        onWordClick={handleWordClick}
                        isAligned={sentence.conversion_status === 'converted'}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* 分页控件 - 现在会紧贴底部 */}
          <div className="flex-none py-1 border-t bg-card/50">
            <div className="flex items-center justify-center gap-0.5">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1 hover:bg-accent/50 rounded-md disabled:opacity-50 text-sm"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "min-w-[1.5rem] h-6 text-xs rounded-md transition-colors",
                    currentPage === page
                      ? "bg-primary/20 text-primary"
                      : "hover:bg-accent/50"
                  )}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1 hover:bg-accent/50 rounded-md disabled:opacity-50 text-sm"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        <ToastViewport />
      </ToastProvider>
    </>
  );
} 