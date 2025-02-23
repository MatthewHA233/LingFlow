'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { parseEpub } from '@/lib/epub-parser';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { GridPattern } from '@/components/ui/grid-pattern';
import { FileUpload } from '@/components/ui/file-upload';
import { motion } from 'framer-motion';

interface FileUploaderProps {
  onBookLoaded: (book: Book, arrayBuffer: ArrayBuffer) => void;
}

interface Resource {
  href: string;
  'media-type'?: string;
  id?: string;
}

interface UploadedResource {
  original_path: string;
  oss_path: string;
}

// 用于上传过程中的临时数据结构
interface UploadChapter {
  title: string;
  content: string;
}

interface LocalBook {
  id?: string;
  title: string;
  author: string;
  cover_url?: string;
  epub_path?: string;
  audio_path?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    language?: string;
    publisher?: string;
    published_date?: string;
    [key: string]: any;
  };
  chapters: UploadChapter[];
  coverUrl?: string;
  resources?: {
    manifest: Record<string, any>;
    imageFiles?: Array<{
      id: string;
      href: string;
      'media-type'?: string;
      type?: string;
    }>;
  };
}

// 添加超时和重试配置
const UPLOAD_TIMEOUT = 300000; // 增加到5分钟
const MAX_RETRIES = 2; // 最大重试次数

export function FileUploader({ onBookLoaded }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadDetail, setUploadDetail] = useState('');
  const [targetProgress, setTargetProgress] = useState(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [totalChapters, setTotalChapters] = useState(0);
  const currentProgressRef = useRef(0); // 添加一个 ref 来跟踪实际进度
  const [showFileInfo, setShowFileInfo] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  // 平滑更新进度
  const updateProgress = (target: number) => {
    if (target < uploadProgress) {
      return;
    }

    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    currentProgressRef.current = target;
    setTargetProgress(target);
    
    progressInterval.current = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= target) {
          clearInterval(progressInterval.current!);
          return target;
        }
        // 使用更平缓的增长曲线
        const increment = Math.min(0.5, (target - prev) * 0.05);
        const newProgress = Math.min(target, prev + increment);
        return Math.round(newProgress * 10) / 10;
      });
    }, 50);
  };

  const handleFile = async (file: File) => {
    try {
      setSelectedFile(file);
      setShowFileInfo(true);

      // 并行开始验证和解析过程
      const [arrayBuffer, { data: { session } }] = await Promise.all([
        file.arrayBuffer(),
        supabase.auth.getSession()
      ]);

      if (!session?.access_token) {
        throw new Error('请先登录');
      }

      // 短暂展示文件信息
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setShowFileInfo(false);
      setIsUploading(true);
      setUploadProgress(10); // 从10%开始，因为验证已完成
      setUploadStage('准备上传');
      setUploadDetail(`正在读取文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

      // 解析EPUB (10-30%)
      const localBook = await parseEpub(file) as LocalBook;
      setTotalChapters(localBook.chapters.length);
      setUploadStage('解析完成');
      setUploadDetail(`解析完成: 《${localBook.title}》 - ${localBook.author}\n共 ${localBook.chapters.length} 章节`);
      updateProgress(30);

      // 准备上传数据
      const uploadData = {
        title: localBook.title,
        author: localBook.author,
        metadata: localBook.metadata,
        coverUrl: localBook.coverUrl,
        chapters: localBook.chapters,
        resources: {
          manifest: localBook.resources?.manifest || {},
          imageFiles: Object.keys(localBook.resources?.manifest || {})
            .filter(key => {
              const item = localBook.resources?.manifest[key];
              return item && (
                item['media-type']?.startsWith('image/') || 
                ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => 
                  item.href.toLowerCase().endsWith(ext)
                )
              );
            })
            .map(key => ({
              id: key,
              ...localBook.resources?.manifest[key]
            }))
        }
      };

      const imageCount = uploadData.resources.imageFiles?.length || 0;
      setTotalImages(imageCount);

      // 2. 验证用户 (5-10%)
      setUploadStage('验证用户');
      setUploadDetail('正在验证用户身份...');
      updateProgress(7);
      updateProgress(10);

      const formData = new FormData();
      formData.append('stage', '1');
      formData.append('file', file);
      formData.append('bookData', JSON.stringify(uploadData));

      updateProgress(10);
      const stage1Response = await fetch('/api/books/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!stage1Response.ok) {
        throw new Error('验证失败');
      }

      const stage1Data = await stage1Response.json();
      setUploadProgress(stage1Data.progress);
      const { bookId, userId } = stage1Data;

      // 3. 上传EPUB文件 (10-40%)
      setUploadStage('上传EPUB文件');
      setUploadDetail(`正在上传EPUB文件: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      updateProgress(20);
      const stage2FormData = new FormData();
      stage2FormData.append('stage', '2');
      stage2FormData.append('bookId', bookId);
      stage2FormData.append('userId', userId);
      stage2FormData.append('file', file);
      stage2FormData.append('bookData', JSON.stringify(uploadData));

      const stage2Response = await fetch('/api/books/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: stage2FormData
      });

      if (!stage2Response.ok) {
        throw new Error('上传EPUB文件失败');
      }

      const stage2Data = await stage2Response.json();
      setUploadProgress(stage2Data.progress);
      const { book } = stage2Data;
      setUploadDetail('EPUB文件上传完成，准备处理资源...');
      updateProgress(40);

      // 4. 处理资源文件 (40-70%)
      setUploadStage('处理资源文件');
      const stage3FormData = new FormData();
      stage3FormData.append('stage', '3');
      stage3FormData.append('bookId', bookId);
      stage3FormData.append('userId', userId);
      stage3FormData.append('file', file);
      stage3FormData.append('bookData', JSON.stringify(uploadData));

      for (let i = 0; i < imageCount; i++) {
        setCurrentImage(i + 1);
        setUploadDetail(`正在处理图片资源 (${i + 1}/${imageCount})`);
        updateProgress(40 + (i + 1) * (20 / imageCount));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const stage3Response = await fetch('/api/books/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: stage3FormData
      });

      if (!stage3Response.ok) {
        throw new Error('处理资源文件失败');
      }

      const stage3Data = await stage3Response.json();
      const { resources } = stage3Data;
      setUploadDetail(`图片资源处理完成: ${imageCount} 个文件`);
      updateProgress(70);

      // 5. 处理章节内容 (70-95%)
      setUploadStage('处理章节内容');
      for (let i = 0; i < localBook.chapters.length; i++) {
        setCurrentChapter(i + 1);
        const chapter = localBook.chapters[i];
        setUploadDetail(`正在处理章节 ${i + 1}/${localBook.chapters.length}: ${chapter.title}`);
        updateProgress(70 + (i + 1) * (25 / localBook.chapters.length));
        await new Promise(resolve => setTimeout(resolve, 75)); // 加快速度
      }

      // 整合资源阶段 (95-99.9%)
      setUploadStage('整合资源');
      setUploadDetail('正在整合数据...');
      updateProgress(95);

      // 加快进度更新速度
      const finalProgressInterval = setInterval(() => {
        const current = currentProgressRef.current;
        if (current < 99.8) {
          // 增加每次更新的幅度
          const next = current + (99.9 - current) * 0.3; // 从0.1改为0.3，加快速度
          currentProgressRef.current = next;
          updateProgress(next);
        }
      }, 300); // 从1000ms改为300ms，更频繁更新

      const stage4FormData = new FormData();
      stage4FormData.append('stage', '4');
      stage4FormData.append('bookId', bookId);
      stage4FormData.append('userId', userId);
      stage4FormData.append('bookData', JSON.stringify(uploadData));

      try {
        const stage4Response = await fetch('/api/books/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: stage4FormData
        });

        const stage4Data = await stage4Response.json();
        
        // 完成上传 (100%)
        setUploadStage('上传完成');
        setUploadDetail(`上传成功：《${localBook.title}》\n共 ${localBook.chapters.length} 章节，${imageCount} 个资源文件`);
        updateProgress(100);

        const mergedBook: Book = {
          ...localBook,
          id: book.id,
          user_id: userId,
          epub_path: book.epub_path,
          cover_url: book.cover_url,
          audio_path: book.audio_path || '',
          created_at: book.created_at,
          updated_at: book.updated_at,
          metadata: book.metadata || {},
          chapters: stage4Data.chapters || []
        };

        onBookLoaded(mergedBook, arrayBuffer);
      } finally {
        clearInterval(finalProgressInterval);
      }

    } catch (error: any) {
      console.error('上传失败:', error);
      setShowFileInfo(false);
      setUploadDetail(`错误: ${error.message || '上传失败'}`);
      toast.error(error.message || '上传失败');
    } finally {
      setTimeout(() => {
        if (progressInterval.current) {
          clearInterval(progressInterval.current);
        }
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStage('');
        setUploadDetail('');
        setCurrentChapter(0);
        setCurrentImage(0);
        setTotalImages(0);
        setTotalChapters(0);
      }, 1000);
    }
  };

  return (
    <div className="w-full">
      {isUploading ? (
        <div className="w-full p-6 md:p-10 rounded-lg relative overflow-hidden min-h-[200px] border-2 border-dashed border-muted">
          {/* 添加背景图案 */}
          <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
            <GridPattern />
          </div>
          
          <div className="relative z-10 space-y-6">
            {/* 主进度条 */}
            <div className="w-full bg-white/10 dark:bg-neutral-800/50 rounded-full h-3 overflow-hidden backdrop-blur-sm">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>

            <div className="space-y-4">
              {/* 状态和百分比 */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-lg font-medium text-neutral-700 dark:text-neutral-300">
                    {uploadStage}
                  </span>
                </div>
                <span className="text-lg font-medium text-primary">
                  {Math.round(uploadProgress)}%
                </span>
              </div>

              {/* 详细信息面板 */}
              {uploadDetail && (
                <div className="flex flex-col gap-3 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-lg p-4 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {uploadDetail}
                  </span>

                  {/* 图片处理进度 */}
                  {currentImage > 0 && totalImages > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                        <span>处理图片资源</span>
                        <span>{currentImage}/{totalImages}</span>
                      </div>
                      <div className="h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/40 transition-all duration-300"
                          style={{ width: `${(currentImage / totalImages) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 章节处理进度 */}
                  {currentChapter > 0 && totalChapters > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                        <span>处理章节内容</span>
                        <span>{currentChapter}/{totalChapters}</span>
                      </div>
                      <div className="h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/40 transition-all duration-300"
                          style={{ width: `${(currentChapter / totalChapters) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : showFileInfo && selectedFile ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full p-6 md:p-10 rounded-lg relative overflow-hidden min-h-[200px] border-2 border-dashed border-muted"
        >
          <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
            <GridPattern />
          </div>
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                正在验证...
              </span>
            </div>
            <div className="bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-lg p-4 border border-neutral-200 dark:border-neutral-800">
              <div className="flex justify-between items-center gap-4">
                <p className="text-base text-neutral-700 dark:text-neutral-300 truncate max-w-xs">
                  {selectedFile.name}
                </p>
                <p className="rounded-lg px-2 py-1 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-white">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                修改于 {new Date(selectedFile.lastModified).toLocaleDateString()}
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <FileUpload
          onChange={files => {
            const file = files[0];
            if (file) handleFile(file);
          }}
        />
      )}
    </div>
  );
}