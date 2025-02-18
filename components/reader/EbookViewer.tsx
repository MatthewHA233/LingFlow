'use client';

import { Book } from '@/types/book';
import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Search, BookOpen, ChevronLeft, ChevronRight, X, Menu } from 'lucide-react';
import JSZip from 'jszip';
import Image from 'next/image';
import path from 'path';

interface EbookViewerProps {
  book: Book;
  arrayBuffer: ArrayBuffer;
  currentChapter: number;
  onChapterChange: (chapter: number) => void;
  processedContent?: string;
}

export function EbookViewer({ 
  book, 
  arrayBuffer,
  currentChapter,
  onChapterChange,
  processedContent
}: EbookViewerProps) {
  // 使用 useMemo 缓存章节数量
  const chaptersCount = useMemo(() => book.chapters.length, [book.chapters]);

  // 使用 useMemo 缓存当前章节数据
  const currentChapterData = useMemo(() => {
    if (currentChapter >= 0 && currentChapter < book.chapters.length) {
      return book.chapters[currentChapter];
    }
    return null;
  }, [book.chapters, currentChapter]);

  // 使用 useCallback 缓存章节切换函数
  const handleChapterChange = useCallback((newChapter: number) => {
    if (newChapter >= 0 && newChapter < chaptersCount) {
      onChapterChange(newChapter);
    }
  }, [chaptersCount, onChapterChange]);

  // 仅在开发环境下输出调试信息
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('EbookViewer 初始化:', {
        chaptersCount,
        currentChapter,
        currentChapterData
      });
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [showToc, setShowToc] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (book.chapters?.length > 0) {
      setIsLoading(false);
    }
  }, [book.chapters]);

  if (isLoading) {
    return <div className="text-center p-8 text-muted-foreground">正在加载电子书内容...</div>;
  }

  if (!currentChapterData) {
    return <div className="p-4 text-red-500">无效的章节</div>;
  }

  // 搜索功能
  const SearchBar = () => (
    <div className="relative mb-6">
      <input
        type="text"
        placeholder="搜索内容..."
        className="w-full p-2 pl-10 rounded-lg border bg-background"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* 顶部导航栏 */}
      <div className="h-10 border-b bg-card/95 backdrop-blur flex items-center px-2 sticky top-0 z-40">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowToc(!showToc)}
            className={`p-1.5 hover:bg-accent rounded-md transition-colors ${
              showToc ? 'bg-accent' : ''
            }`}
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleChapterChange(Math.max(0, currentChapter - 1))}
            disabled={currentChapter === 0}
            className="p-1.5 hover:bg-accent rounded-md disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleChapterChange(Math.min(chaptersCount - 1, currentChapter + 1))}
            disabled={currentChapter === chaptersCount - 1}
            className="p-1.5 hover:bg-accent rounded-md disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 px-4">
          <h2 className="text-sm font-medium truncate text-center">
            {currentChapterData.title}
          </h2>
        </div>
        <div className="w-[76px]" />
      </div>

      {/* 内容区域 */}
      <div className="flex-1 relative">
        {/* 主要内容 */}
        <div className="h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-6">
            <SearchBar />
            <div className="prose prose-sm dark:prose-invert mx-auto">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
                remarkPlugins={[remarkGfm]}
                remarkRehypeOptions={{ allowDangerousHtml: true }}
                components={{
                  p: ({ children }) => (
                    <p className="text-base leading-7 tracking-normal mb-4">{children}</p>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-semibold mb-6 mt-8">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold mb-4 mt-6">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-medium mb-3 mt-5">{children}</h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 mb-4 space-y-2">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 mb-4 space-y-2">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-base leading-7">{children}</li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/20 pl-4 italic my-4">{children}</blockquote>
                  ),
                  img: ({ node, ...props }) => {
                    const imgSrc = props.src || '';
                    const imgAlt = props.alt || '电子书插图';
                    
                    return (
                      <figure className="my-6 relative w-full" style={{ minHeight: '300px' }}>
                        {imgSrc.startsWith('blob:') ? (
                          <img
                            src={imgSrc}
                            alt={imgAlt}
                            className="object-contain w-full h-full"
                            style={{ maxWidth: '100%', height: 'auto' }}
                          />
                        ) : (
                          <Image
                            src={imgSrc}
                            alt={imgAlt}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        )}
                      </figure>
                    );
                  },
                  div: ({ node, className, children, ...props }) => {
                    if (className?.includes('book-image')) {
                      const imgElement = Array.isArray(children) 
                        ? children.find(child => 
                            typeof child === 'object' && 
                            'props' in child && 
                            child.type === 'img'
                          )
                        : null;

                      if (imgElement && typeof imgElement === 'object' && 'props' in imgElement) {
                        const imgProps = imgElement.props;
                        return (
                          <figure className="my-6 relative w-full" style={{ minHeight: '300px' }}>
                            <Image
                              src={imgProps.src || ''}
                              alt={imgProps.alt || '电子书插图'}
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </figure>
                        );
                      }
                    }
                    return <div className={className} {...props}>{children}</div>;
                  }
                }}
              >
                {processedContent || currentChapterData?.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* 目录 */}
        <div className={`
          fixed left-0 top-[5.5rem] w-64 h-[calc(100vh-5.5rem)] bg-card
          transform transition-transform duration-300 ease-in-out border-r shadow-lg z-30
          ${showToc ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="h-full flex flex-col">
            <div className="p-3 border-b bg-card/95 backdrop-blur sticky top-0">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> 目录
              </h3>
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
      </div>
    </div>
  );
}