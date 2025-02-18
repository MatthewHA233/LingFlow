'use client';

import { useState, useEffect } from 'react';
import { EbookViewer } from './EbookViewer';
import { AudioRecognizer } from './AudioRecognizer';
import { DraggableAudioPlayer } from './DraggableAudioPlayer';
import { AudioPlayer } from './AudioPlayer';
import { Book } from '@/types/book';
import { processChapterContent } from '@/lib/content-processor';
import { supabase } from '@/lib/supabase-client';
import { X, Mic, Menu, Headphones, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [showToc, setShowToc] = useState(false);

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

  const handleChapterChange = (newChapter: number) => {
    setCurrentChapter(newChapter);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 阅读器导航栏 */}
      <div className="fixed top-16 left-0 right-0 h-12 border-b bg-card/95 backdrop-blur flex items-center px-4 z-40">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowToc(!showToc)}
            className={`p-1.5 hover:bg-accent rounded-md transition-colors ${
              showToc ? 'bg-accent/30' : ''
            }`}
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleChapterChange(Math.max(0, currentChapter - 1))}
              disabled={currentChapter === 0}
              className="p-1.5 hover:bg-accent rounded-md disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleChapterChange(Math.min(book.chapters.length - 1, currentChapter + 1))}
              disabled={currentChapter === book.chapters.length - 1}
              className="p-1.5 hover:bg-accent rounded-md disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 px-4">
          <div className="text-center">
            <h1 className="text-base font-semibold truncate">{book.title}</h1>
            <h2 className="text-sm text-muted-foreground truncate">
              {book.chapters[currentChapter]?.title}
            </h2>
          </div>
        </div>
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

      {/* 主要内容区域 */}
      <div className="flex-1 pt-28">
        {/* 阅读器 */}
        <div className={`h-full transition-all duration-300 ${showAudioPanel ? 'mr-[400px]' : ''}`}>
          <EbookViewer 
            book={book} 
            arrayBuffer={arrayBuffer}
            currentChapter={currentChapter}
            onChapterChange={setCurrentChapter}
            processedContent={processedContent}
            showToc={showToc}
            onShowTocChange={setShowToc}
          />
        </div>

        {/* 目录侧边栏 */}
        <div className={`
          fixed left-0 top-28 w-64 h-[calc(100vh-7rem)]
          transform transition-all duration-300 ease-in-out border-r shadow-lg z-30
          bg-card/95 backdrop-blur
          ${showToc ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="h-full flex flex-col">
            <div className="p-3 border-b bg-card/95 backdrop-blur sticky top-0">
              <h3 className="text-sm font-medium">目录</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-0.5">
                {book.chapters.map((chapter, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      handleChapterChange(index);
                      setShowToc(false);
                    }}
                    className={`block w-full text-left px-2 py-1.5 rounded-md text-sm ${
                      currentChapter === index 
                        ? 'bg-primary/10 text-primary' 
                        : 'hover:bg-accent'
                    }`}
                  >
                    {chapter.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 音频处理抽屉面板 */}
        <div className={`
          fixed right-0 top-28 w-[600px] h-[calc(100vh-7rem)]
          transform transition-all duration-300 ease-in-out
          bg-card/95 backdrop-blur border-l shadow-lg z-30
          ${showAudioPanel ? 'translate-x-0' : 'translate-x-full'}
          group
        `}>
          {/* 拖拽调整宽度的把手 */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/20 group-hover:bg-primary/10"
            onMouseDown={(e) => {
              const panel = e.currentTarget.parentElement;
              if (!panel) return;

              const startX = e.pageX;
              const startWidth = panel.offsetWidth;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaX = moveEvent.pageX - startX;
                const newWidth = Math.max(300, Math.min(800, startWidth - deltaX));
                panel.style.width = `${newWidth}px`;
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />

          {/* 音频处理区域 */}
          <div className="flex-1 flex flex-col h-full">
            <div className="p-2 border-b bg-card/95 backdrop-blur sticky top-0 z-30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Mic className="w-4 h-4 text-primary/80" />
                  <h2 className="text-sm font-medium">音频处理</h2>
                </div>
                <button
                  onClick={() => setShowAudioPanel(false)}
                  className="p-1 hover:bg-accent rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
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

      {/* 可拖拽音频播放器 */}
      {audioUrl && (
        <DraggableAudioPlayer
          key={audioUrl}
          bookId={book.id}
          audioUrl={audioUrl}
          currentTime={currentTime}
          onTimeUpdate={setCurrentTime}
        />
      )}

      {/* 全局导航栏控制 */}
      <style jsx global>{`
        nav.fixed {
          transition: transform 0.3s ease;
        }
        nav.fixed.hidden {
          transform: translateY(-100%);
        }
      `}</style>
      <script dangerouslySetInnerHTML={{
        __html: `
          let lastScrollY = window.scrollY;
          const mainNav = document.querySelector('nav.fixed');
          
          window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
              mainNav?.classList.add('hidden');
            } else if (currentScrollY < lastScrollY || currentScrollY < 50) {
              mainNav?.classList.remove('hidden');
            }
            
            lastScrollY = currentScrollY;
          });
        `
      }} />
    </div>
  );
} 