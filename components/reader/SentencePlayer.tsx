'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from 'react-beautiful-dnd';
import { debounce } from 'lodash';

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
}

interface SentencePlayerProps {
  speechId: string;
  onTimeChange: (time: number) => void;
  currentTime?: number;
}

export function SentencePlayer({ speechId, onTimeChange, currentTime = 0 }: SentencePlayerProps) {
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

  // 重置状态
  useEffect(() => {
    console.log('speechId 变化，重置状态');
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
  }, [speechId]);

  // 计算当前播放的句子索引
  useEffect(() => {
    if (sentences.length === 0 || !currentTime) return;

    const index = sentences.findIndex(
      sentence => currentTime >= sentence.begin_time && currentTime <= sentence.end_time
    );
    
    if (index !== -1) {
      setActiveSentenceIndex(index);
      // 确保当前播放的句子在可视范围内
      if (index < visibleRange.start || index > visibleRange.end) {
        setVisibleRange({
          start: Math.max(0, index - 5),
          end: Math.min(sentences.length - 1, index + 5)
        });
      }
    }
  }, [currentTime, sentences]);

  // 计算单词的播放进度
  const getWordProgress = (word: Word) => {
    if (!currentTime) return 0;
    if (currentTime < word.begin_time) return 0;
    if (currentTime > word.end_time) return 100;
    return ((currentTime - word.begin_time) / (word.end_time - word.begin_time)) * 100;
  };

  const fetchSentencesAndWords = useCallback(async (currentPage: number) => {
    if (!speechId) {
      console.log('没有 speechId，跳过加载');
      setLoading(false);
      return;
    }

    console.log('加载句子数据, speechId:', speechId, '页码:', currentPage);
    try {
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
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      
      // 估算每个句子的平均高度
      const itemHeight = 35;
      
      // 计算可见区域能显示的大致句子数量
      const visibleItems = Math.ceil(clientHeight / itemHeight);
      
      // 计算当前滚动位置对应的句子索引
      const startIndex = Math.floor(scrollTop / itemHeight);
      
      // 更新可视范围，上下多缓存一些句子
      setVisibleRange({
        start: Math.max(0, startIndex - 5),
        end: Math.min(sentences.length - 1, startIndex + visibleItems + 5)
      });

      // 检查是否需要加载更多
      // 当滚动到距离底部 200px 时就开始加载
      if (scrollHeight - scrollTop - clientHeight < 200) {
        if (!loadingRef.current && hasMore) {
          console.log('触发加载更多, 当前页码:', page);
          loadingRef.current = true;  // 设置加载状态
          setPage(prev => prev + 1);
        }
      }
    }, 100);

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      handleScroll.cancel();
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [loading, hasMore, scrollContainer, sentences.length, page]);

  // 初始加载和页码变化时加载数据
  useEffect(() => {
    if (speechId && hasMore) {
      console.log('开始加载数据, 页码:', page);
      fetchSentencesAndWords(page);
    }
  }, [speechId, page, fetchSentencesAndWords]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(sentences);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // 更新本地状态
    setSentences(items);

    // 计算新的顺序
    const updates = items.map((sentence, index) => ({
      id: sentence.id,
      order: index + 1
    }));

    // 批量更新数据库
    try {
      const { error } = await supabase
        .from('sentences')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;
    } catch (err) {
      console.error('更新句子顺序失败:', err);
      // 如果失败，重新加载数据
      fetchSentencesAndWords(page);
    }
  };

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
  const renderSentenceContent = useCallback((sentence: Sentence) => {
    const textContent = sentence.text_content;
    const words = sentence.words;
    const result: (Word | string)[] = [];
    
    let currentPosition = 0;
    words.forEach(word => {
      // 查找当前单词在文本中的位置
      const wordIndex = textContent.indexOf(word.word, currentPosition);
      if (wordIndex > currentPosition) {
        // 添加单词前的标点符号和空格
        result.push(textContent.slice(currentPosition, wordIndex));
      }
      result.push(word);
      currentPosition = wordIndex + word.word.length;
    });
    
    // 添加最后剩余的标点符号
    if (currentPosition < textContent.length) {
      result.push(textContent.slice(currentPosition));
    }
    
    return result;
  }, []);

  if (loading && page === 1) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  if (error && sentences.length === 0) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="sentences">
        {(provided) => (
          <div
            className="max-h-[600px] overflow-y-auto pr-2 relative scroll-smooth"
            {...provided.droppableProps}
            ref={(el) => {
              provided.innerRef(el);
              setScrollContainer(el);
            }}
          >
            {/* 添加占位元素以保持滚动位置 */}
            <div style={{ height: `${visibleRange.start * 35}px` }} />
            
            {sentences.slice(visibleRange.start, visibleRange.end + 1).map((sentence, index) => {
              const actualIndex = index + visibleRange.start;
              const isActive = actualIndex === activeSentenceIndex;
              const sentenceContent = renderSentenceContent(sentence);
              
              return (
                <Draggable
                  key={sentence.id}
                  draggableId={sentence.id}
                  index={actualIndex}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`group relative bg-card rounded-lg transition-all duration-300 text-sm 
                        ${isActive ? 'scale-[1.02] shadow-lg bg-primary/5 my-2 p-2' : 'p-1.5 my-0.5'} 
                        ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                      onClick={() => handleSentenceClick(sentence)}
                    >
                      {/* 拖拽手柄 */}
                      <div
                        {...provided.dragHandleProps}
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                      >
                        <DragHandleDots2Icon className="w-3 h-3 text-muted-foreground" />
                      </div>
                      
                      {/* 句子内容 */}
                      <div className="pl-4">
                        {/* 时间戳 - 只在激活时显示 */}
                        {isActive && (
                          <div className="mb-1 text-xs text-muted-foreground">
                            <span>{formatTime(sentence.begin_time)} - {formatTime(sentence.end_time)}</span>
                          </div>
                        )}

                        {/* 单词和标点符号 */}
                        <div className="leading-relaxed">
                          {sentenceContent.map((item, idx) => {
                            if (typeof item === 'string') {
                              // 渲染标点符号和空格
                              return <span key={idx} className="text-muted-foreground">{item}</span>;
                            } else {
                              // 渲染单词
                              const progress = getWordProgress(item);
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="inline-block px-1 rounded hover:bg-primary/10 cursor-pointer transition-colors relative focus:outline-none focus:ring-1 focus:ring-primary active:bg-primary/20"
                                  onClick={(e) => handleWordClick(item, e)}
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

                        {/* 语速和情感值 - 只在激活时显示 */}
                        {isActive && (sentence.speech_rate || sentence.emotion_value) && (
                          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                            {sentence.speech_rate && (
                              <span>语速: {sentence.speech_rate}字/分钟</span>
                            )}
                            {sentence.emotion_value && (
                              <span>情感值: {sentence.emotion_value}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Draggable>
              );
            })}
            
            {/* 添加占位元素以保持滚动位置 */}
            <div style={{ height: `${(sentences.length - visibleRange.end - 1) * 35}px` }} />
            
            {provided.placeholder}
            {loading && (
              <div className="p-2 text-center text-muted-foreground text-xs">
                加载更多...
              </div>
            )}
            {!loading && !hasMore && sentences.length > 0 && (
              <div className="p-2 text-center text-muted-foreground text-xs">
                没有更多数据了
              </div>
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
} 