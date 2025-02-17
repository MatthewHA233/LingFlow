'use client';

import { Book } from '@/types/book';
import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { Search, BookOpen, ChevronLeft, ChevronRight, X, Menu } from 'lucide-react';
import JSZip from 'jszip';
import Image from 'next/image';
import path from 'path';

interface EbookViewerProps {
  book: Book;
  arrayBuffer: ArrayBuffer;
}

export function EbookViewer({ book, arrayBuffer }: EbookViewerProps) {
  // 添加调试日志
  console.log('当前书籍数据:', book);
  console.log('章节数量:', book.chapters?.length);
  
  const [currentChapter, setCurrentChapter] = useState(() => {
    return book.chapters?.length > 0 ? 0 : -1;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showToc, setShowToc] = useState(false);
  const [processedContent, setProcessedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
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
  const processChapterContent = useCallback(async (content: string): Promise<string> => {
    const blobUrls: string[] = [];
    try {
      console.log('开始处理章节内容中的图片');
      const zip = await JSZip.loadAsync(arrayBuffer);
      const manifest = book.resources?.manifest || {};
      
      console.log('资源清单:', manifest);
      console.log('ZIP文件列表:', Object.keys(zip.files));

      // 改进路径映射表创建和匹配逻辑
      const pathMapping = Object.values(manifest).reduce((acc: Record<string, string>, item: any) => {
        if (item.href) {
          const normalized = item.href
            .replace(/\\/g, '/')
            .replace(/^\//, '')
            .toLowerCase();
          acc[normalized] = item.href;
          acc[path.basename(normalized)] = item.href;
          console.log('添加路径映射:', {
            normalized,
            original: item.href
          });
        }
        return acc;
      }, {});

      console.log('最终路径映射:', pathMapping);

      // 处理内容中的图片
      const resolvedContent = await Promise.all(
        content.split('\n').map(async (line) => {
          if (!line.includes('![')) return line;
          
          console.log('处理包含图片的行:', line);
          
          return await Promise.all(
            line.split(/(!?\[.*?\]\(.*?\))/).map(async (part) => {
              if (!part.match(/!\[.*?\]\(.*?\)/)) return part;
              
              const [, alt = '', src = ''] = part.match(/!\[(.*?)\]\((.*?)\)/) || [];
              const normalizedSrc = src.replace(/\\/g, '/').replace(/^\//, '').toLowerCase();
              
              console.log('处理图片标记:', {
                original: part,
                alt,
                src,
                normalizedSrc
              });

              // 首先检查是否有对应的 OSS URL
              const resourceEntry = Object.entries(book.resources?.manifest || {}).find(([_, item]) => {
                const itemPath = item.href?.replace(/\\/g, '/').replace(/^\//, '').toLowerCase();
                return itemPath === normalizedSrc;
              });

              if (resourceEntry && resourceEntry[1].oss_url) {
                console.log('使用 OSS URL:', resourceEntry[1].oss_url);
                return `![${alt}](${resourceEntry[1].oss_url})`;
              }

              // 如果没有 OSS URL，尝试从 ZIP 中获取
              // 尝试多种路径组合
              const possiblePaths = [
                src,
                normalizedSrc,
                `OEBPS/${src}`,
                `OPS/${src}`,
                pathMapping[normalizedSrc],
                ...Object.keys(zip.files).filter(filePath => {
                  const fileBaseName = path.basename(filePath).toLowerCase();
                  const srcBaseName = path.basename(normalizedSrc).toLowerCase();
                  return fileBaseName === srcBaseName;
                })
              ].filter(Boolean);

              console.log('尝试的路径组合:', possiblePaths);

              // 尝试找到图片文件
              let imageFile = null;
              let foundPath = '';
              for (const testPath of possiblePaths) {
                imageFile = zip.file(testPath);
                if (imageFile) {
                  foundPath = testPath;
                  console.log(`找到图片文件: ${testPath}`);
                  break;
                }
              }

              if (!imageFile) {
                // 尝试在manifest中查找
                const manifestEntry = Object.values(manifest).find(item => {
                  if (!item.href) return false;
                  const itemPath = item.href.replace(/\\/g, '/').replace(/^\//, '').toLowerCase();
                  return itemPath.endsWith(path.basename(normalizedSrc));
                });

                if (manifestEntry?.href) {
                  imageFile = zip.file(manifestEntry.href);
                  if (imageFile) {
                    foundPath = manifestEntry.href;
                    console.log(`通过manifest找到图片文件: ${foundPath}`);
                  }
                }

                if (!imageFile) {
                  console.warn(`未找到图片文件: ${src}，尝试的路径:`, possiblePaths);
                  return part;
                }
              }

              try {
                const blob = await imageFile.async('blob');
                const blobUrl = URL.createObjectURL(blob);
                blobUrls.push(blobUrl);
                console.log('成功创建图片Blob URL:', {
                  original: src,
                  blobUrl,
                  size: blob.size
                });
                return `![${alt}](${blobUrl})`;
              } catch (error) {
                console.error(`处理图片失败: ${src}`, error);
                return part;
              }
            })
          ).then(parts => parts.join(''));
        })
      ).then(lines => lines.join('\n'));

      return resolvedContent;
    } catch (error) {
      console.error('处理图片路径失败:', error);
      return content;
    } finally {
      // 清理之前的 blob URLs
      blobUrls.forEach(URL.revokeObjectURL);
    }
  }, [arrayBuffer, book.resources?.manifest]);

  // 在渲染内容之前处理图片
  useEffect(() => {
    if (currentChapterData?.content) {
      processChapterContent(currentChapterData.content)
        .then(processedContent => {
          setProcessedContent(processedContent);
        })
        .catch(error => {
          console.error('处理章节内容时出错:', error);
        });
    }
  }, [currentChapter, currentChapterData, processChapterContent]);

  // 清理blob URLs
  useEffect(() => {
    return () => {
      const images = document.querySelectorAll('.prose img[src^="blob:"]');
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src) URL.revokeObjectURL(src);
      });
    };
  }, [currentChapter]);

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