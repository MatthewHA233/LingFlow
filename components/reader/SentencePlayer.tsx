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
import { Play, Pause, GripVertical, AlignCenter } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { formatTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { AudioController, AUDIO_EVENTS } from '@/lib/audio-controller';

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
}

export function SentencePlayer({ speechId, onTimeChange, currentTime = 0, isAlignMode = false, onToggleAlignMode }: SentencePlayerProps) {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const pageSize = 50;  // 增加每页加载的数量
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(-1);
  const lastClickTimeRef = useRef<number>(0);
  const MIN_CLICK_INTERVAL = 200;
  const loadingRef = useRef(false);  // 添加加载状态的 ref
  const speechIdRef = useRef(speechId); // 添加 speechId 的 ref
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const sentenceTimers = useRef<{[key: string]: NodeJS.Timeout}>({});
  const [hideAligned, setHideAligned] = useState(false);

  // 重置状态 - 仅在 speechId 变化时执行一次
  useEffect(() => {
    if (speechIdRef.current === speechId) return;
    
    console.log('speechId 变化，重置状态');
    speechIdRef.current = speechId;
    setSentences([]);
    setHasMore(true);
    setPage(1);
    setLoading(true);
    setError(null);
    setVisibleRange({ start: 0, end: 20 });
    setActiveSentenceIndex(-1);
    loadingRef.current = false;
    
    // 重置滚动位置
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [speechId, scrollContainer]);

  // 计算当前播放的句子索引
  useEffect(() => {
    if (sentences.length === 0 || !currentTime) return;

    // 使用 requestAnimationFrame 限制更新频率
    const rafId = requestAnimationFrame(() => {
      const index = sentences.findIndex(
        sentence => currentTime >= sentence.begin_time && currentTime <= sentence.end_time
      );
      
      if (index !== -1 && index !== activeSentenceIndex) {
        setActiveSentenceIndex(index);
        // 只在句子变化时更新可视范围
        if (index < visibleRange.start || index > visibleRange.end) {
          setVisibleRange({
            start: Math.max(0, index - 5),
            end: Math.min(sentences.length - 1, index + 5)
          });
        }
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentTime, sentences, activeSentenceIndex, visibleRange.start, visibleRange.end, sentences.length]);

  // 计算单词的播放进度
  const getWordProgress = useCallback((word: Word, currentTime: number) => {
    if (!currentTime) return 0;
    if (currentTime < word.begin_time) return 0;
    if (currentTime > word.end_time) return 100;
    return ((currentTime - word.begin_time) / (word.end_time - word.begin_time)) * 100;
  }, []);

  const fetchSentencesAndWords = useCallback(async (currentPage: number) => {
    if (!speechId || loadingRef.current) {
      console.log('跳过加载：speechId 无效或正在加载中');
      return;
    }

    console.log('加载句子数据, speechId:', speechId, '页码:', currentPage);
    try {
      loadingRef.current = true;
      setLoading(true);
      // 获取分页的句子数据
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: sentencesData, error: sentencesError } = await supabase
        .from('sentences')
        .select('*')
        .eq('speech_id', speechId)
        .order('order', { ascending: true })
        .range(from, to);

      if (sentencesError) throw sentencesError;
      
      if (!sentencesData || sentencesData.length === 0) {
        setHasMore(false);
        if (currentPage === 1) {
          setError('没有找到句子数据');
        }
        setLoading(false);
        loadingRef.current = false;
        return;
      }

      // 获取这些句子对应的单词
      const { data: wordsData, error: wordsError } = await supabase
        .from('words')
        .select('*')
        .in('sentence_id', sentencesData.map(s => s.id))
        .order('begin_time', { ascending: true });

      if (wordsError) throw wordsError;

      // 组织数据结构
      const sentencesWithWords = sentencesData.map(sentence => ({
        ...sentence,
        words: wordsData.filter(word => word.sentence_id === sentence.id)
      }));

      // 如果是第一页，直接设置数据
      // 如果不是第一页，追加数据
      setSentences(prev => 
        currentPage === 1 ? sentencesWithWords : [...prev, ...sentencesWithWords]
      );
      
      setHasMore(sentencesData.length === pageSize);
      console.log('数据加载完成，是否还有更多:', sentencesData.length === pageSize);
    } catch (err: any) {
      console.error('加载句子数据失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [speechId]);

  // 监听滚动事件
  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = debounce(() => {
      if (loadingRef.current || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      
      // 估算每个句子的平均高度 - 减小为合理值
      const itemHeight = 28; // 从35减为28
      
      // 增加预加载触发距离，提前加载
      if (scrollHeight - scrollTop - clientHeight < 300) { // 从200增加到300
        console.log('触发加载更多, 当前页码:', page);
        setPage(prev => prev + 1);
      }
      
      // 更新可视区域，加大缓冲区
      const visibleItems = Math.ceil(clientHeight / itemHeight);
      const startIndex = Math.floor(scrollTop / itemHeight);
      
      setVisibleRange({
        start: Math.max(0, startIndex - 10), // 从5增加到10
        end: Math.min(sentences.length - 1, startIndex + visibleItems + 10) // 从5增加到10
      });
    }, 50); // 减少防抖时间，从100ms到50ms

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      handleScroll.cancel();
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainer, sentences.length, page, hasMore]);

  // 初始加载和页码变化时加载数据
  useEffect(() => {
    if (!speechId || !hasMore || loadingRef.current) return;
    
    console.log('开始加载数据, 页码:', page);
    fetchSentencesAndWords(page);
  }, [speechId, page, hasMore, fetchSentencesAndWords]);

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

  // 过滤句子列表
  const filteredSentences = useMemo(() => {
    if (!hideAligned) return sentences;
    return sentences.filter(sentence => sentence.conversion_status !== 'converted');
  }, [sentences, hideAligned]);

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
        className={`p-1 rounded-lg transition-colors ${
          isActive ? 'bg-accent/30' : 'hover:bg-accent/20'
        }`}
        onClick={() => onSentenceClick(sentence)}
      >
        <div className="pl-3">
          {isActive && (
            <div className="mb-0.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-[10px]">{formatTime(sentence.begin_time)} - {formatTime(sentence.end_time)}</span>
                <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-1">
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
          <div className="leading-relaxed">
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
    if (!isAlignMode) return; // 只在对齐模式下可拖拽
    
    // 设置拖拽数据
    const dragData = {
      type: 'sentence',
      sentenceId: sentence.id,
      speechId: speechId,
      text: sentence.text_content,
      beginTime: sentence.begin_time,
      endTime: sentence.end_time
    };
    
    try {
      // 确保数据格式正确
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
      
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
  
  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50');
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
    setIsPlaying(isPlayStarted);
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
          setIsPlaying(newIsPlaying);
          
          // 如果开始播放，重置活动单词索引
          if (newIsPlaying) {
            setActiveSentenceIndex(null);
          }
        } else {
          // 如果与其他句子相关，重置自己的状态
          setIsPlaying(false);
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
      setHideAligned(!hideAligned);
    };
    
    window.addEventListener('toggle-hide-aligned', handleToggleHideAligned);
    
    return () => {
      window.removeEventListener('toggle-hide-aligned', handleToggleHideAligned);
    };
  }, [hideAligned]);

  if (loading && page === 1) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  if (error && sentences.length === 0) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div
      ref={setScrollContainer}
      className="h-[calc(100vh-19rem)] overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/30"
    >
      <div className="space-y-1 p-2">
        {filteredSentences.slice(visibleRange.start, visibleRange.end + 1).map((sentence, index) => {
          const actualIndex = filteredSentences.indexOf(sentence);
          const isAligned = sentence.conversion_status === 'converted';
          
          return (
            <div 
              key={sentence.id || actualIndex}
              className={cn(
                "relative p-1.5 rounded-md border shadow-sm",
                isAligned ? "bg-emerald-950/10" : "bg-card", 
                activeSentenceId === sentence.id ? 'border-primary' : 'border-border',
                isAlignMode ? 'cursor-grab active:cursor-grabbing' : ''
              )}
              draggable={isAlignMode}
              onDragStart={(e) => isAlignMode && handleDragStart(e, sentence)}
              onDragEnd={handleDragEnd}
            >
              {isAligned && (
                <div className="absolute right-1 top-1 w-2 h-2 bg-emerald-500 rounded-full" 
                     title="已完成对齐"></div>
              )}
              
              {isAlignMode && (
                <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-6 opacity-40 group-hover:opacity-100">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              
              <div className={isAlignMode ? "pl-4" : ""}>
                <SentenceItem
                  sentence={sentence}
                  isActive={actualIndex === activeSentenceIndex}
                  currentTime={currentTime}
                  onSentenceClick={handleSentenceClick}
                  onWordClick={handleWordClick}
                  isAligned={isAligned}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 