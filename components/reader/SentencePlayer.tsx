'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from 'react-beautiful-dnd';

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
}

export function SentencePlayer({ speechId, onTimeChange }: SentencePlayerProps) {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSentencesAndWords = async () => {
    console.log('开始加载句子数据, speechId:', speechId);
    try {
      // 获取所有句子
      const { data: sentencesData, error: sentencesError } = await supabase
        .from('sentences')
        .select('*')
        .eq('speech_id', speechId)
        .order('order', { ascending: true });

      console.log('句子数据:', sentencesData, '错误:', sentencesError);

      if (sentencesError) throw sentencesError;
      if (!sentencesData || sentencesData.length === 0) {
        setError('没有找到句子数据');
        setLoading(false);
        return;
      }

      // 获取所有单词
      const { data: wordsData, error: wordsError } = await supabase
        .from('words')
        .select('*')
        .in('sentence_id', sentencesData.map(s => s.id))
        .order('begin_time', { ascending: true });

      console.log('单词数据:', wordsData, '错误:', wordsError);

      if (wordsError) throw wordsError;

      // 组织数据结构
      const sentencesWithWords = sentencesData.map(sentence => ({
        ...sentence,
        words: wordsData.filter(word => word.sentence_id === sentence.id)
      }));

      console.log('处理后的句子数据:', sentencesWithWords);
      setSentences(sentencesWithWords);
    } catch (err: any) {
      console.error('加载句子数据失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (speechId) {
      console.log('SentencePlayer 组件收到 speechId:', speechId);
      fetchSentencesAndWords();
    }
  }, [speechId]);

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
      fetchSentencesAndWords();
    }
  };

  const handleSentenceClick = (beginTime: number) => {
    console.log('点击句子，跳转到时间:', beginTime);
    onTimeChange(beginTime);
  };

  const handleWordClick = (beginTime: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('点击单词，跳转到时间:', beginTime);
    onTimeChange(beginTime);
  };

  if (loading) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="sentences">
        {(provided) => (
          <div
            className="space-y-4"
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            {sentences.map((sentence, index) => (
              <Draggable
                key={sentence.id}
                draggableId={sentence.id}
                index={index}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`group relative bg-card rounded-lg p-4 ${
                      snapshot.isDragging ? 'shadow-lg' : ''
                    }`}
                    onClick={() => handleSentenceClick(sentence.begin_time)}
                  >
                    {/* 拖拽手柄 */}
                    <div
                      {...provided.dragHandleProps}
                      className="absolute left-2 top-1/2 -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                    >
                      <DragHandleDots2Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    
                    {/* 句子内容 */}
                    <div className="pl-6">
                      <div className="text-sm text-muted-foreground mb-1">
                        {formatTime(sentence.begin_time)} - {formatTime(sentence.end_time)}
                      </div>
                      <div className="space-x-1">
                        {sentence.words.map((word) => (
                          <span
                            key={word.id}
                            className="inline-block px-1 py-0.5 rounded border border-primary/20 hover:bg-primary/10 cursor-pointer transition-colors"
                            onClick={(e) => handleWordClick(word.begin_time, e)}
                            title={`点击播放: ${word.word}`}
                          >
                            {word.word}
                          </span>
                        ))}
                      </div>
                      
                      {/* 额外信息 */}
                      {(sentence.speech_rate || sentence.emotion_value) && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {sentence.speech_rate && (
                            <span className="mr-4">语速: {sentence.speech_rate}字/分钟</span>
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
            ))}
            {provided.placeholder}
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