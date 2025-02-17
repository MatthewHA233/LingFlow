'use client';

import { Book } from '@/types/book';
import { useState, useEffect, useCallback } from 'react';
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
  processedContent: string;
}

export function EbookViewer({ 
  book, 
  arrayBuffer,
  currentChapter,
  onChapterChange,
  processedContent 
}: EbookViewerProps) {
  // 添加调试日志
  console.log('当前书籍数据:', book);
  console.log('章节数量:', book.chapters?.length);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showToc, setShowToc] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const chapters = book.chapters || [];
  
  console.log('当前章节索引:', currentChapter);
  console.log('当前章节数据:', chapters[currentChapter]);

  const currentChapterData = chapters[currentChapter];
  
  // 章节索引安全校验
  useEffect(() => {
    if (currentChapter >= chapters.length) {
      console.warn('章节索引越界，重置到第一章');
      onChapterChange(0);
    }
  }, [chapters.length, currentChapter, onChapterChange]);

  useEffect(() => {
    if (book.chapters?.length > 0) {
      setIsLoading(false);
    }
  }, [book.chapters]);

  if (isLoading) {
    return <div className="text-center p-8 text-muted-foreground">正在加载电子书内容...</div>;
  }

  if (!chapters.length || !currentChapterData) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        电子书内容加载失败，请检查控制台日志并尝试重新上传
      </div>
    );
  }

  // 目录导航
  const TableOfContents = () => (
    <div className={`
      absolute left-0 top-0 h-full w-64 bg-card
      transform transition-transform duration-300 ease-in-out
      border-r
      ${showToc ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="p-4">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5" /> 目录
        </h2>
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {chapters.map((chapter, index) => (
            <button
              key={index}
              onClick={() => {
                onChapterChange(index);
                setShowToc(false);
              }}
              className={`block w-full text-left p-2 rounded text-sm ${
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
  );

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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-card rounded-xl shadow-lg relative overflow-hidden">
        {/* 顶部导航栏 */}
        <div className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowToc(!showToc)}
                className={`p-2 hover:bg-accent rounded-lg transition-transform duration-300 ${
                  showToc ? 'rotate-90' : ''
                }`}
                aria-label={showToc ? '收起目录' : '展开目录'}
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => onChapterChange(Math.max(0, currentChapter - 1))}
                disabled={currentChapter === 0}
                className="p-2 hover:bg-accent rounded-lg disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => onChapterChange(Math.min(chapters.length - 1, currentChapter + 1))}
                disabled={currentChapter === chapters.length - 1}
                className="p-2 hover:bg-accent rounded-lg disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <h1 className="text-lg font-semibold truncate flex-1 text-center">
              {currentChapterData.title}
            </h1>
            <div className="w-[88px]" />
          </div>
        </div>

        {/* 内容容器 */}
        <div className="flex">
          <TableOfContents />
          
          {/* 主要内容区域 */}
          <div className={`
            flex-1 transition-transform duration-300
            ${showToc ? 'translate-x-64' : 'translate-x-0'}
          `}>
            <div className="p-6 md:p-8">
              <SearchBar />
              <div className="prose prose-lg max-w-none dark:prose-invert">
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw, rehypeHighlight]}
                  remarkPlugins={[remarkGfm]}
                  remarkRehypeOptions={{ allowDangerousHtml: true }}
                  components={{
                    p: ({ children }) => (
                      <p className="mb-6 leading-relaxed">{children}</p>
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
                      // 处理book-image div
                      if (className?.includes('book-image')) {
                        // 尝试从children中找到img元素
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
        </div>
      </div>
    </div>
  );
}