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

// 添加一个事件名称常量
const ALIGNMENT_EVENTS = {
  ALIGNMENT_START: 'sentence-alignment-start',
  ALIGNMENT_UPDATE: 'sentence-alignment-update',
  ALIGNMENT_COMPLETE: 'sentence-alignment-complete'
};

// 修改CSS动画样式
const animationStyles = `
  @keyframes pulse {
    0% { 
      transform: scale(1); 
      opacity: 1; 
      background-color: rgba(34, 197, 94, 0.05);
      border-color: rgba(34, 197, 94, 0.3);
    }
    50% { 
      transform: scale(1.02); 
      opacity: 0.9; 
      background-color: rgba(34, 197, 94, 0.15);
      border-color: rgba(34, 197, 94, 0.6);
    }
    100% { 
      transform: scale(1); 
      opacity: 1; 
      background-color: rgba(34, 197, 94, 0.05);
      border-color: rgba(34, 197, 94, 0.3);
    }
  }
  
  @keyframes highlight {
    0% { 
      background-color: rgba(34, 197, 94, 0.05);
      border-color: rgba(34, 197, 94, 0.3);
    }
    50% { 
      background-color: rgba(34, 197, 94, 0.2);
      border-color: rgba(34, 197, 94, 0.8);
    }
    100% { 
      background-color: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.5);
    }
  }
  
  .alignment-pulse {
    animation: pulse 1.5s infinite ease-in-out;
    border-width: 2px;
  }
  
  .alignment-complete {
    animation: highlight 1s ease-out forwards;
    border-width: 2px;
  }
  
  .sentence-item {
    transition: all 0.3s ease-out;
  }
  
  .sentence-item.aligning {
    transform-origin: center left;
  }
`;

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
  const [lastAlignmentUpdateTime, setLastAlignmentUpdateTime] = useState(0);
  const [isAligningInProgress, setIsAligningInProgress] = useState(false);

  // 添加日志记录的辅助函数，方便打印集合内容
  const logSet = (name: string, set: Set<string>) => {
    console.log(`${name}: [${Array.from(set).join(', ')}]`);
  };

  // 修改 setAligningIds 和 setAlignmentCompleted 的调用方式，添加日志
  const updateAligningIds = (newIds: Set<string>) => {
    logSet('设置对齐中状态', newIds);
    setAligningIds(newIds);
  };

  const updateAlignmentCompleted = (newIds: Set<string>) => {
    logSet('设置对齐完成状态', newIds);
    setAlignmentCompleted(newIds);
  };

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
        words: sentence.words.sort((a: Word, b: Word) => a.begin_time - b.begin_time)
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
    // 如果正在对齐中，不要立即加载数据
    if (isAligningInProgress) {
      console.log('正在对齐中，延迟加载数据');
      return;
    }
    
    loadSentences(currentPage);
  }, [currentPage, loadSentences, isAligningInProgress]);

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
      [sentence, currentTime]
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
      
      // 添加标识类型
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
  
  // 修改处理拖拽结束的逻辑
  const handleDragEnd = async (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-50');
    const sentenceId = e.currentTarget.getAttribute('data-sentence-id');
    
    if (!sentenceId) return;

    try {
      // 1. 标记对齐开始，防止页面变化时立即加载数据
      setIsAligningInProgress(true);
      
      // 2. 获取当前句子以计算目标页码
      const { data: targetSentence } = await supabase
        .from('sentences')
        .select('order')
        .eq('id', sentenceId)
        .single();

      if (!targetSentence) {
        setIsAligningInProgress(false);
        return;
      }

      // 3. 计算目标句子所在的页码
      const targetPage = Math.ceil(targetSentence.order / pageSize);
      
      // 4. 不再在这里设置所有连续句子为对齐中状态
      // 相反，只设置被拖拽的句子为对齐中，等待服务返回实际对齐结果
      setAligningIds(new Set([sentenceId]));
      
      console.log('handleDragEnd: 发送对齐开始事件，目标页码:', targetPage);
      
      // 5. 广播对齐开始事件，不触发页面跳转
      window.dispatchEvent(new CustomEvent(ALIGNMENT_EVENTS.ALIGNMENT_START, {
        detail: {
          sentenceId: sentenceId,
          // 不再发送所有连续句子的ID，只发送当前拖拽的句子ID
          alignedSentenceIds: [sentenceId], // 只设置当前拖拽的句子为对齐中
          speechId,
          targetPage,
          shouldSkipPageChange: true, // 添加标记，表示不要立即跳转页面
          isDragging: true // 添加标记，表示这是由拖拽引起的对齐
        }
      }));
    } catch (err) {
      console.error('对齐处理失败:', err);
      setAligningIds(new Set());
      setIsAligningInProgress(false);
    }
  };

  // 恢复正确的对齐点监听（空依赖数组的）
  useEffect(() => {
    const handleAlignmentStart = (e: CustomEvent) => {
      const { sentenceId, sentenceIds, alignedSentenceIds } = e.detail || {};
      
      // 优先使用 alignedSentenceIds，其次使用 sentenceIds，最后使用 sentenceId
      const idsToAlign = alignedSentenceIds || sentenceIds || (sentenceId ? [sentenceId] : []);
      
      if (idsToAlign.length > 0) {
        // 只设置对齐中状态，不触发页面跳转和数据刷新
        const aligningIdSet = new Set<string>(idsToAlign);
        console.log('收到对齐开始事件，设置对齐中状态', idsToAlign);
        updateAligningIds(aligningIdSet);
      }
    };
    
    window.addEventListener(ALIGNMENT_EVENTS.ALIGNMENT_START, handleAlignmentStart as EventListener);
    
    return () => {
      window.removeEventListener(ALIGNMENT_EVENTS.ALIGNMENT_START, handleAlignmentStart as EventListener);
    };
  }, []);

  // 修改对齐状态更新函数，添加对失败状态的处理
  const refreshAlignmentStatus = useCallback(async (targetSentenceIds?: string[]) => {
    if (!speechId || !targetSentenceIds?.length) return;
    
    try {
      // 查询数据库获取最新状态
        const { data: updatedSentences } = await supabase
          .from('sentences')
          .select(`
            id,
            conversion_status,
            text_content,
          order,
            words (
              id,
              word,
              begin_time,
              end_time,
              sentence_id
            )
          `)
        .in('id', targetSentenceIds)
        .eq('speech_id', speechId);
      
      if (!updatedSentences?.length) return;
      
      // 检查是否有状态变化
      const hasStatusChanges = updatedSentences.some(updated => {
        const current = sentences.find(s => s.id === updated.id);
        return current?.conversion_status !== updated.conversion_status;
      });
      
      if (hasStatusChanges) {
        console.log('检测到对齐状态变化，准备更新界面', updatedSentences);
        
        // 获取第一个更新的句子的页码
        const firstUpdatedSentence = updatedSentences[0];
        const targetPage = Math.ceil(firstUpdatedSentence.order / pageSize);
        
        // 更新对齐状态
        const newAligningIds = new Set(aligningIds);
        const newCompletedIds = new Set(alignmentCompleted);
        
        updatedSentences.forEach(updated => {
          if (updated.conversion_status === 'converted') {
            newAligningIds.delete(updated.id);
            newCompletedIds.add(updated.id);
          }
        });
        
        // 如果所有句子都已完成对齐
        const allCompleted = Array.from(aligningIds).every(id => 
          !newAligningIds.has(id) || newCompletedIds.has(id)
        );
        
        if (allCompleted && newAligningIds.size === 0) {
          // 1. 先设置完成状态，显示完成动画
          updateAligningIds(new Set());
          updateAlignmentCompleted(newCompletedIds);
          
          // 2. 等待完成动画显示完毕
          setTimeout(() => {
            // 3. 更新句子数据 - 就地更新而不是重新加载
          setSentences(prev => 
            prev.map(s => {
              const updated = updatedSentences.find(us => us.id === s.id);
              if (updated) {
                return {
                  ...s,
                  ...updated,
                    words: updated.words.sort((a: Word, b: Word) => a.begin_time - b.begin_time)
                };
              }
              return s;
            })
          );

            // 4. 清除完成状态
            updateAlignmentCompleted(new Set());
            
            // 5. 最后跳转到目标页面，并允许加载数据
            setIsAligningInProgress(false);
            setCurrentPage(targetPage);
          }, 2000); // 等待2秒让完成动画显示
        } else {
          // 仍在对齐中，只更新状态
          updateAligningIds(newAligningIds);
          updateAlignmentCompleted(newCompletedIds);
        }
        
        // 记录更新时间
        setLastAlignmentUpdateTime(Date.now());
      }
    } catch (err) {
      console.error('刷新对齐状态失败:', err);
      setIsAligningInProgress(false);
    }
  }, [speechId, sentences, aligningIds, alignmentCompleted, pageSize]);

  // 添加对ALIGNMENT_UPDATE和ALIGNMENT_COMPLETE事件的监听
  useEffect(() => {
    // 处理对齐更新事件，包括失败状态
    const handleAlignmentUpdate = (e: CustomEvent) => {
      const detail = e.detail as {
        sentenceId?: string,
        sentenceIds?: string[],
        alignedSentenceIds?: string[],
        status?: string,
        shouldSkipPageChange?: boolean,
        blockId?: string,
        isProcessing?: boolean
      };
      const { sentenceId, sentenceIds, alignedSentenceIds, status, shouldSkipPageChange, isProcessing } = detail || {};
      
      console.log('SentencePlayer: 收到对齐更新事件', detail);
      
      // 如果是失败状态，清除对齐中状态
      if (status === 'failed') {
        console.log('收到对齐失败事件，清除对齐状态');
        updateAligningIds(new Set());
        setIsAligningInProgress(false);
        return;
      }
      
      // 处理对齐处理中状态
      if (status === 'processing') {
        // 获取所有需要设置为对齐中状态的句子ID
        const idsToAlign = alignedSentenceIds || sentenceIds || (sentenceId ? [sentenceId] : []);
        
        if (idsToAlign.length > 0) {
          console.log('收到对齐处理中事件，设置对齐中状态:', idsToAlign);
          
          // 更新对齐中的句子状态，仅针对传入的句子ID
          const newAligningIds = new Set<string>(idsToAlign);
          updateAligningIds(newAligningIds);
          
          // 设置成对齐进行中，防止页面刷新
          setIsAligningInProgress(true);
          
          // 如果带有isProcessing标志，表示ContextBlocks正在处理单词级对齐
          // 不需要开始轮询，等待ContextBlocks发送完成事件
          if (isProcessing) {
            console.log('ContextBlocks正在处理单词级对齐，等待完成事件...');
            return;
          }
        }
      }
      
      // 如果是转换状态（旧的转换已完成但未发送完成事件），处理类似成功
      if (status === 'converted') {
        // 获取所有需要设置为对齐中状态的句子ID
        const idsToCheck = alignedSentenceIds || sentenceIds || (sentenceId ? [sentenceId] : []);
        
        if (idsToCheck.length > 0) {
          console.log('收到转换完成事件，开始轮询状态:', idsToCheck);
          
          // 更新对齐中的句子状态，仅针对传入的句子ID
          const newAligningIds = new Set<string>(idsToCheck);
          updateAligningIds(newAligningIds);
          
          // 设置成对齐进行中，防止页面刷新
          setIsAligningInProgress(true);
          
          // 开始轮询检查对齐状态 - 使用轮询可确保获取最新状态
          const pollAlignmentStatus = async () => {
            // 创建一个定时器，每1秒检查一次
            const timer = setInterval(async () => {
              try {
                // 查询数据库获取最新状态
                const { data: updatedSentences } = await supabase
                  .from('sentences')
                  .select('id, conversion_status, order')
                  .in('id', idsToCheck)
                  .eq('speech_id', speechId);
                  
                if (!updatedSentences || updatedSentences.length === 0) {
                  return;
                }
                
                // 检查是否所有句子都已对齐完成
                const allConverted = updatedSentences.every(s => s.conversion_status === 'converted');
                
                if (allConverted) {
                  console.log('所有句子对齐完成，停止轮询');
                  clearInterval(timer);
                  
                  // 找出已完成的句子，添加到完成集合，从对齐中移除
                  const newCompletedIds = new Set(alignmentCompleted);
                  const newAligningIds = new Set(aligningIds);
                  
                  updatedSentences.forEach(s => {
                    if (s.conversion_status === 'converted') {
                      newCompletedIds.add(s.id);
                      newAligningIds.delete(s.id);
                    }
                  });
                  
                  // 更新状态，触发完成动画
                  updateAligningIds(newAligningIds);
                  updateAlignmentCompleted(newCompletedIds);
                  
                  // 2秒后清除完成状态并更新数据
          setTimeout(() => {
                    // 计算目标页码
                    const firstSentence = updatedSentences.sort((a, b) => a.order - b.order)[0];
                    const targetPage = Math.ceil(firstSentence.order / pageSize);
                    
                    // 更新数据 - 就地更新而不是重新加载
                    setSentences(prev => 
                      prev.map(s => {
                        const updated = updatedSentences.find(us => us.id === s.id);
                        if (updated) {
                          return {
                            ...s,
                            conversion_status: updated.conversion_status
                          };
                        }
                        return s;
                      })
                    );
                    
                    // 清除完成状态
                    updateAlignmentCompleted(new Set());
                    
                    // 发送单词更新事件，通知ContextBlocks重新加载单词数据
                    console.log('SentencePlayer: 发送单词更新事件，通知ContextBlocks重新加载单词数据');
                    window.dispatchEvent(new CustomEvent('words-alignment-complete', {
                      detail: {
                        sentenceIds: Array.from(newCompletedIds),  // 所有被对齐的句子ID
                        speechId: speechId,
                        blockId: detail.blockId
                      }
                    }));
                    
                    // 如果不需要跳过页面变化，则更新页面
                    if (!shouldSkipPageChange) {
                      setCurrentPage(targetPage);
                    }
                    
                    // 解除阻塞状态
                    setIsAligningInProgress(false);
                    
                    // 主动请求完整的句子数据（包括words）
                    loadSentences(targetPage);
          }, 2000);
                }
              } catch (err) {
                console.error('轮询对齐状态失败:', err);
              }
            }, 1000);
            
            // 最多轮询30秒
            setTimeout(() => {
              clearInterval(timer);
              // 如果超时，也要解除阻塞状态
              setIsAligningInProgress(false);
            }, 30000);
          };
          
          pollAlignmentStatus();
        }
      }
    };
    
    // 处理对齐完成事件
    const handleAlignmentComplete = (e: CustomEvent) => {
      const detail = e.detail as { 
        sentenceId?: string,
        sentenceIds?: string[],
        alignedSentenceIds?: string[],
        blockId?: string, 
        shouldSkipPageChange?: boolean,
        targetPage?: number,
        status?: string
      };
      const { sentenceId, sentenceIds, alignedSentenceIds, blockId, shouldSkipPageChange, targetPage, status } = detail || {};
      
      // 获取完成的句子ID列表
      const completedIds = alignedSentenceIds || sentenceIds || (sentenceId ? [sentenceId] : []);
      
      // 处理超时状态
      if (status === 'timeout') {
        console.log('SentencePlayer: 收到对齐超时事件，清除对齐中状态但不显示完成动画');
        // 直接清除对齐中状态，不显示完成动画
        updateAligningIds(new Set());
        setIsAligningInProgress(false);
        return;
      }
      
      if (completedIds.length > 0) {
        console.log('SentencePlayer: 收到对齐完成事件，句子IDs:', completedIds);
        
        // 由于此时后端处理已经完成，直接查询最新状态
        (async () => {
          try {
            // 查询所有涉及的句子的最新状态
            const { data: updatedSentences } = await supabase
              .from('sentences')
              .select('id, conversion_status, order, text_content')
              .in('id', completedIds)
              .eq('speech_id', speechId);
              
            if (!updatedSentences || updatedSentences.length === 0) {
              return;
            }
            
            console.log('对齐完成，获取到更新的句子:', updatedSentences);
            
            // 更新对齐中和完成状态 - 仅处理传入的句子ID
            const newAligningIds = new Set(aligningIds);
            const newCompletedIds = new Set(alignmentCompleted);
            
            // 将所有完成的句子从对齐中移到完成状态
            completedIds.forEach(id => {
              newAligningIds.delete(id);
              
              // 只有真正转换成功的句子才显示完成动画
              const sentence = updatedSentences.find(s => s.id === id);
              if (sentence && sentence.conversion_status === 'converted') {
                newCompletedIds.add(id);
              }
            });
            
            // 设置对齐完成状态，触发动画显示
            updateAligningIds(newAligningIds);
            updateAlignmentCompleted(newCompletedIds);
            
            // 设置计时器，在动画结束后更新数据
            if (newCompletedIds.size > 0) {
      setTimeout(() => {
                // 更新数据 - 就地更新而不是重新加载
                setSentences(prev => 
                  prev.map(s => {
                    const updated = updatedSentences.find(us => us.id === s.id);
                    if (updated) {
                      return {
                        ...s,
                        conversion_status: updated.conversion_status,
                        text_content: updated.text_content
                      };
                    }
                    return s;
                  })
                );
                
                // 清除完成状态
                updateAlignmentCompleted(new Set());
                
                // 发送单词更新事件，通知ContextBlocks重新加载单词数据
                console.log('SentencePlayer: 发送单词更新事件，通知ContextBlocks重新加载单词数据');
                window.dispatchEvent(new CustomEvent('words-alignment-complete', {
                  detail: {
                    sentenceIds: Array.from(newCompletedIds),  // 所有被对齐的句子ID
                    speechId: speechId,
                    blockId: blockId
                  }
                }));
                
                // 确定目标页码 - 优先使用传入的目标页码，否则计算
                const finalTargetPage = targetPage || Math.ceil(
                  (updatedSentences.sort((a, b) => a.order - b.order)[0]?.order || 1) / pageSize
                );
                
                // 如果不需要跳过页面变化，则更新页面
                if (!shouldSkipPageChange) {
                  setCurrentPage(finalTargetPage);
                }
                
                // 解除阻塞状态
                setIsAligningInProgress(false);
                
                // 主动请求完整的句子数据（包括words）
                loadSentences(finalTargetPage);
              }, 2000); // 等待2秒让完成动画显示
            } else {
              // 如果没有完成的句子，直接解除阻塞
              setIsAligningInProgress(false);
            }
    } catch (err) {
            console.error('处理对齐完成事件失败:', err);
            setIsAligningInProgress(false);
          }
        })();
      }
    };
    
    // 添加事件监听
    window.addEventListener(ALIGNMENT_EVENTS.ALIGNMENT_UPDATE, handleAlignmentUpdate as EventListener);
    window.addEventListener(ALIGNMENT_EVENTS.ALIGNMENT_COMPLETE, handleAlignmentComplete as EventListener);
    
    return () => {
      window.removeEventListener(ALIGNMENT_EVENTS.ALIGNMENT_UPDATE, handleAlignmentUpdate as EventListener);
      window.removeEventListener(ALIGNMENT_EVENTS.ALIGNMENT_COMPLETE, handleAlignmentComplete as EventListener);
    };
  }, [speechId, aligningIds, alignmentCompleted, refreshAlignmentStatus, pageSize, loadSentences]);

  // 修改togglePlay函数
  const togglePlay = () => {
    // 确保有活动句子
    if (!activeSentenceId || !sentences.length) return;
    
    // 找到活动句子
    const activeSentence = sentences.find(s => s.id === activeSentenceId);
    if (!activeSentence) return;
    
    const playerId = `sentence-${activeSentenceId}`;
    
    // 播放音频 - 使用正确的参数格式
    let isPlayStarted: boolean = false;
    try {
      // AudioController.play 接受一个选项对象
      AudioController.play({
        url: audioUrl,
        startTime: activeSentence.begin_time,
        endTime: activeSentence.end_time,
        context: 'sentence',
        loop: false
      });
      isPlayStarted = true;
    } catch (err) {
      console.error('音频播放失败:', err);
      isPlayStarted = false;
    }
    
    // 更新状态
    setPlayingStates(prev => ({ ...prev, [playerId]: isPlayStarted }));
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
          setPlayingStates(prev => ({ ...prev, [playerId]: newIsPlaying }));
          
          // 如果开始播放，重置活动单词索引
          if (newIsPlaying) {
            setActiveSentenceIndex(-1);
          }
        } else {
          // 如果与其他句子相关，重置自己的状态
          setPlayingStates(prev => ({ ...prev, [playerId]: false }));
          setActiveSentenceIndex(-1);
        }
      }
    };
    
    window.addEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
    
    return () => {
      window.removeEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
    };
  }, [activeSentenceId]);

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

  // 定义正确的状态颜色类型映射
  const statusColors: Record<string, string> = {
    none: 'bg-red-500',
    converted: 'bg-emerald-500',
    reverted: 'bg-yellow-500',
    default: 'bg-gray-500' // 默认颜色
  };

  // 添加样式到文档
  useEffect(() => {
    // 创建样式元素
    const styleEl = document.createElement('style');
    styleEl.textContent = animationStyles;
    document.head.appendChild(styleEl);
    
    // 清理函数
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

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
                  <div
                    key={sentence.id}
                    data-sentence-id={sentence.id}
                    style={{
                      transition: 'all 0.3s ease-out'
                    }}
                    className={cn(
                      'relative p-1 rounded-sm border shadow-sm sentence-item',
                      sentence.conversion_status === 'converted' ? 'bg-emerald-950/10' : 'bg-card',
                      activeSentenceId === sentence.id ? 'border-primary' : 'border-border',
                      'cursor-grab active:cursor-grabbing',
                      isAligning && 'alignment-pulse aligning',
                      isCompleted && 'alignment-complete'
                    )}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, sentence)}
                    onDragEnd={handleDragEnd}
                  >
                    {/* 状态指示器灯 */}
                    <div 
                      className={cn(
                        "absolute right-1 top-1 w-2 h-2 rounded-full",
                        statusColors[sentence.conversion_status || 'none'] || statusColors.default
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
                  </div>
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