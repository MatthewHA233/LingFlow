'use client';

import { useState, useEffect } from 'react';
import { AudioRecognizer } from './AudioRecognizer';
import { DraggableAudioPlayer } from './DraggableAudioPlayer';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { X, Mic, Menu, ChevronLeft, ChevronRight } from 'lucide-react';

interface ReaderContentProps {
  book: Book;
  arrayBuffer: ArrayBuffer;
}

// 语境块组件
function ContextBlock({ block, resources }: { block: any; resources: Array<{ original_path: string; oss_path: string }> }) {
  const getOssUrl = (originalPath: string) => {
    const resource = resources.find(r => r.original_path === originalPath);
    return resource?.oss_path || originalPath;
  };

  const renderContent = () => {
    switch (block.block_type) {
      case 'heading_1':
        return <h1 className="text-4xl font-bold my-6">{block.content}</h1>;
      case 'heading_2':
        return <h2 className="text-3xl font-bold my-5">{block.content}</h2>;
      case 'heading_3':
        return <h3 className="text-2xl font-bold my-4">{block.content}</h3>;
      case 'heading_4':
        return <h4 className="text-xl font-bold my-3">{block.content}</h4>;
      case 'heading_5':
        return <h5 className="text-lg font-bold my-2">{block.content}</h5>;
      case 'heading_6':
        return <h6 className="text-base font-bold my-2">{block.content}</h6>;
      case 'image':
        const imageUrl = getOssUrl(block.content);
        return (
          <div className="my-4">
            <img 
              src={imageUrl}
              alt={block.metadata?.alt || ''}
              className="max-w-full rounded-lg shadow-md"
              onError={(e) => {
                console.error('图片加载失败:', {
                  originalUrl: block.content,
                  ossUrl: imageUrl
                });
                e.currentTarget.src = '/placeholder-image.png'; // 添加一个占位图
              }}
            />
          </div>
        );
      default:
        return (
          <p className="text-base leading-relaxed my-3 whitespace-pre-wrap">
            {block.content}
          </p>
        );
    }
  };

  return (
    <div className="hover:bg-accent/5 px-4 -mx-4 rounded transition-colors">
      {renderContent()}
    </div>
  );
}

export function ReaderContent({ book, arrayBuffer }: ReaderContentProps) {
  const [currentChapter, setCurrentChapter] = useState(0);
  const [resources, setResources] = useState<Array<{ original_path: string; oss_path: string }>>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [contextBlocks, setContextBlocks] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [parentIds, setParentIds] = useState<Record<number, string>>({});

  // 预加载相邻章节的数据
  const preloadAdjacentChapters = async (currentIndex: number) => {
    const adjacentIndices = [currentIndex - 1, currentIndex + 1].filter(
      index => index >= 0 && index < book.chapters.length
    );

    for (const index of adjacentIndices) {
      if (!contextBlocks[index] && parentIds[index]) {
        const { data } = await supabase
          .from('context_blocks')
          .select('*')
          .eq('parent_id', parentIds[index])
          .order('order_index');

        if (data) {
          setContextBlocks(prev => ({
            ...prev,
            [index]: data
          }));
        }
      }
    }
  };

  // 一次性加载所有章节的 parent_id
  useEffect(() => {
    async function loadAllParentIds() {
      try {
        const { data, error } = await supabase
          .from('chapters')
          .select('order_index, parent_id')
          .eq('book_id', book.id)
          .order('order_index');

        if (error) {
          console.error('加载章节父级ID失败:', error);
          return;
        }

        const idMap = data.reduce((acc, chapter) => {
          acc[chapter.order_index] = chapter.parent_id;
          return acc;
        }, {} as Record<number, string>);

        setParentIds(idMap);
      } catch (err) {
        console.error('加载章节父级ID失败:', err);
      }
    }

    loadAllParentIds();
  }, [book.id]);

  // 加载资源信息(只加载一次)
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

        // 规范化资源路径
        const normalizedResources = (data || []).map(resource => ({
          original_path: resource.original_path.replace(/^OEBPS\//, '').replace(/^OPS\//, ''),
          oss_path: resource.oss_path
        }));

        console.log('加载的资源:', normalizedResources);
        setResources(normalizedResources);
      } catch (err) {
        console.error('加载资源信息失败:', err);
      }
    }

    if (resources.length === 0) {
      loadResources();
    }
  }, [book.id, resources.length]);

  // 加载当前章节的语境块
  useEffect(() => {
    async function loadContextBlocks() {
      // 如果已经有缓存数据,直接使用
      if (contextBlocks[currentChapter]) {
        return;
      }

      try {
        setLoading(true);
        
        const parentId = parentIds[currentChapter];
        if (!parentId) {
          console.error('未找到章节对应的parent_id');
          return;
        }

        const { data: blocks, error: blocksError } = await supabase
          .from('context_blocks')
          .select('*')
          .eq('parent_id', parentId)
          .order('order_index');

        if (blocksError) {
          console.error('加载语境块失败:', blocksError);
          return;
        }

        setContextBlocks(prev => ({
          ...prev,
          [currentChapter]: blocks || []
        }));

        // 预加载相邻章节
        preloadAdjacentChapters(currentChapter);

      } catch (err) {
        console.error('加载语境块失败:', err);
      } finally {
        setLoading(false);
      }
    }

    if (book.id && currentChapter >= 0 && parentIds[currentChapter]) {
      loadContextBlocks();
    }
  }, [book.id, currentChapter, parentIds, contextBlocks]);

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
      <div className="flex-1 pt-28 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            contextBlocks[currentChapter]?.map((block, index) => (
              <ContextBlock 
                key={block.id || index} 
                block={block}
                resources={resources}
              />
            ))
          )}
        </div>
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