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
import React from 'react';

interface EbookViewerProps {
  book: Book;
  arrayBuffer: ArrayBuffer;
  currentChapter: number;
  onChapterChange: (chapter: number) => void;
  processedContent?: string;
  showToc: boolean;
  onShowTocChange: (show: boolean) => void;
}

export function EbookViewer({ 
  book, 
  arrayBuffer,
  currentChapter,
  onChapterChange,
  processedContent,
  showToc,
  onShowTocChange
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
  }, [chaptersCount, currentChapter, currentChapterData]);

  const [searchQuery, setSearchQuery] = useState('');
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
      {/* 内容区域 */}
      <div className="flex-1 relative">
        {/* 主要内容 */}
        <div className="h-full overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-6">
            <SearchBar />
            <div className="prose prose-sm dark:prose-invert mx-auto">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
                remarkPlugins={[remarkGfm]}
                remarkRehypeOptions={{ allowDangerousHtml: true }}
                components={{
                  p: ({ children, ...props }) => {
                    // 检查是否包含 Image 组件
                    const hasImage = React.Children.toArray(children).some(
                      child => React.isValidElement(child) && child.type === Image
                    );
                    
                    // 如果包含图片，使用 div 而不是 p
                    if (hasImage) {
                      return <div className="text-base leading-7 tracking-normal mb-4">{children}</div>;
                    }
                    
                    return <p className="text-base leading-7 tracking-normal mb-4" {...props}>{children}</p>;
                  },
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
                    
                    // 只允许 OSS 链接
                    if (!imgSrc.includes('oss-cn-beijing.aliyuncs.com')) {
                      return (
                        <div className="my-6 relative w-full h-[300px] bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground">图片未上传到 OSS</span>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="my-6">
                        <div className="relative w-full" style={{ minHeight: '300px' }}>
                          <Image
                            src={imgSrc}
                            alt={imgAlt}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      </div>
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
                        const imgSrc = imgProps.src || '';
                        
                        // 只允许 OSS 链接
                        if (!imgSrc.includes('oss-cn-beijing.aliyuncs.com')) {
                          return (
                            <div className="my-6 relative w-full h-[300px] bg-muted flex items-center justify-center">
                              <span className="text-muted-foreground">图片未上传到 OSS</span>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="my-6">
                            <div className="relative w-full" style={{ minHeight: '300px' }}>
                              <Image
                                src={imgSrc}
                                alt={imgProps.alt || '电子书插图'}
                                fill
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                          </div>
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
          fixed left-0 top-24 w-64 h-[calc(100vh-6rem)] bg-card
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
                      onShowTocChange(false);
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