'use client';

import { Book } from '@/types/book';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { Search, BookOpen, ChevronLeft, ChevronRight, X, Menu } from 'lucide-react';

interface EbookViewerProps {
  book: Book;
}

export function EbookViewer({ book }: EbookViewerProps) {
  // 添加调试日志
  console.log('当前书籍数据:', book);
  console.log('章节数量:', book.chapters?.length);
  
  const [currentChapter, setCurrentChapter] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showToc, setShowToc] = useState(false);
  
  const chapters = book.chapters || [];
  
  console.log('当前章节索引:', currentChapter);
  console.log('当前章节数据:', chapters[currentChapter]);

  const currentChapterData = chapters[currentChapter];
  
  // 章节索引安全校验
  useEffect(() => {
    if (currentChapter >= chapters.length) {
      console.warn('章节索引越界，重置到第一章');
      setCurrentChapter(0);
    }
  }, [chapters.length, currentChapter]);

  // 在组件顶部添加图片处理函数
  const processChapterContent = async (content: string): Promise<string> => {
    const div = document.createElement('div');
    div.innerHTML = content;
    
    const images = div.getElementsByTagName('img');
    for (const img of Array.from(images)) {
      try {
        const src = img.getAttribute('src');
        if (!src || src.startsWith('blob:') || src.startsWith('data:')) continue;

        // 从URL中提取图片路径
        const imagePath = src.startsWith('/') ? src.substring(1) : src;
        let imageResource;

        // 尝试多种匹配方式
        if (book.resources?.manifest) {
          imageResource = book.resources.manifest.find((resource: any) => {
            // 匹配完整路径
            if (resource.href === imagePath) return true;
            // 匹配文件名
            const resourceFile = resource.href.split('/').pop();
            const srcFile = imagePath.split('/').pop();
            return resourceFile === srcFile;
          });
        }

        if (!imageResource) {
          // 尝试直接加载原始路径
          try {
            const imageBlob = await book.loadBlob(imagePath);
            if (imageBlob) {
              const url = URL.createObjectURL(new Blob([imageBlob]));
              img.setAttribute('src', url);
              return;
            }
          } catch (error) {
            console.error('直接加载图片失败:', error);
          }
        }
      } catch (error) {
        console.error('处理图片失败:', error);
      }
    }
    
    return div.innerHTML;
  };

  // 在渲染内容之前处理图片
  useEffect(() => {
    if (currentChapterData?.content) {
      processChapterContent(currentChapterData.content)
        .then(processedContent => {
          // 更新章节内容
          currentChapterData.content = processedContent;
        })
        .catch(error => {
          console.error('处理章节内容时出错:', error);
        });
    }
  }, [currentChapter]);

  // 清理blob URLs
  useEffect(() => {
    return () => {
      const content = document.querySelector('.prose');
      if (content) {
        const images = content.querySelectorAll('img[src^="blob:"]');
        images.forEach(img => {
          const src = img.getAttribute('src');
          if (src) URL.revokeObjectURL(src);
        });
      }
    };
  }, [currentChapter]);

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
                setCurrentChapter(index);
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
                onClick={() => setCurrentChapter(Math.max(0, currentChapter - 1))}
                disabled={currentChapter === 0}
                className="p-2 hover:bg-accent rounded-lg disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentChapter(Math.min(chapters.length - 1, currentChapter + 1))}
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
                  rehypePlugins={[rehypeHighlight]}
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="mb-6 leading-relaxed">{children}</p>
                    ),
                    img: ({ node, ...props }) => (
                      <p className="my-6">
                        <img
                          {...props}
                          className="mx-auto rounded-lg shadow-md"
                          loading="lazy"
                          onError={(e) => {
                            const img = e.currentTarget;
                            console.error('图片加载失败:', img.src);
                          }}
                        />
                      </p>
                    ),
                  }}
                >
                  {currentChapterData.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}