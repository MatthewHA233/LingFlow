'use client';

import { useState, useEffect } from 'react';
import { EbookViewer } from './EbookViewer';
import { AudioRecognizer } from './AudioRecognizer';
import { DraggableAudioPlayer } from './DraggableAudioPlayer';
import { AudioPlayer } from './AudioPlayer';
import { Book } from '@/types/book';
import { processChapterContent } from '@/lib/content-processor';
import { supabase } from '@/lib/supabase-client';
import { X, Mic, Menu, Headphones } from 'lucide-react';

interface ReaderContentProps {
  book: Book;
  arrayBuffer: ArrayBuffer;
}

export function ReaderContent({ book, arrayBuffer }: ReaderContentProps) {
  const [currentChapter, setCurrentChapter] = useState(0);
  const [processedContent, setProcessedContent] = useState<string>('');
  const [resources, setResources] = useState<Array<{ original_path: string; oss_path: string }>>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const [showAudioPanel, setShowAudioPanel] = useState(false);

  // 加载资源信息
  useEffect(() => {
    async function loadResources() {
      try {
        const { data, error } = await supabase
          .from('book_resources')
          .select('original_path, oss_path')
          .eq('book_id', book.id);

        if (error) {
          console.error('加载资源信息失败:', error);
          return;
        }

        setResources(data || []);
      } catch (err) {
        console.error('加载资源信息失败:', err);
      }
    }

    loadResources();
  }, [book.id]);

  // 处理当前章节内容
  useEffect(() => {
    if (book.chapters[currentChapter]?.content && resources.length > 0) {
      const { content } = processChapterContent(
        book.chapters[currentChapter].content,
        resources
      );
      setProcessedContent(content);
    }
  }, [currentChapter, book.chapters, resources]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部导航栏 */}
      <div className="h-12 border-b bg-card/95 backdrop-blur flex items-center px-4 sticky top-0 z-50">
        <div className="flex-1 text-center">
          <h1 className="text-lg font-semibold truncate">{book.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAudioPanel(!showAudioPanel)}
            className={`p-1.5 hover:bg-accent/50 rounded-md transition-colors relative ${
              showAudioPanel ? 'bg-accent/30' : ''
            }`}
            title="音频处理"
          >
            <Mic className={`w-4 h-4 transition-colors ${
              showAudioPanel ? 'text-primary/80' : ''
            }`} />
            {audioUrl && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 relative">
        {/* 阅读器 */}
        <div className="h-full">
          <EbookViewer 
            book={book} 
            arrayBuffer={arrayBuffer}
            currentChapter={currentChapter}
            onChapterChange={setCurrentChapter}
            processedContent={processedContent}
          />
        </div>

        {/* 音频处理抽屉面板 */}
        <div className={`
          fixed right-0 bottom-0 w-[400px] h-[calc(100vh-3rem)]
          transform transition-transform duration-300 ease-in-out
          bg-card border-l shadow-lg z-30
          ${showAudioPanel ? 'translate-x-0' : 'translate-x-full'}
        `}>
          {/* 音频处理区域 */}
          <div className="flex-1 flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b bg-card/95 backdrop-blur sticky top-0 z-30">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-primary/80" />
                <h2 className="text-base font-medium">音频处理</h2>
              </div>
              <button
                onClick={() => setShowAudioPanel(false)}
                className="p-1.5 hover:bg-accent rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <AudioRecognizer
                bookContent={book.chapters[currentChapter]?.content || ''}
                bookId={book.id}
                onAudioUrlChange={setAudioUrl}
                onTimeChange={setCurrentTime}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 可拖拽音频播放器 - 始终显示在右下角 */}
      {audioUrl && (
        <DraggableAudioPlayer
          key={audioUrl}
          bookId={book.id}
          audioUrl={audioUrl}
          currentTime={currentTime}
          onTimeUpdate={setCurrentTime}
        />
      )}
    </div>
  );
} 