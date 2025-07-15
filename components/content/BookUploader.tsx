'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Loader2, CheckCircle2, Terminal, ChevronDown, ChevronUp, XCircle, Layers, MessageSquare } from 'lucide-react';
import { parseEpub } from '@/lib/epub-parser';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { GridPattern } from '@/components/ui/grid-pattern';
import { FileUpload } from '@/components/ui/file-upload';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface BookUploaderProps {
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

// 日志类型
interface LogEntry {
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
}

// 添加超时和重试配置
const UPLOAD_TIMEOUT = 300000; // 增加到5分钟
const MAX_RETRIES = 2; // 最大重试次数

// 获取日志样式
const getLogStyle = (level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR') => {
  switch(level) {
    case 'INFO':
      return { 
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        icon: <span className="w-2 h-2 rounded-full bg-blue-400 mr-1" />
      };
    case 'DEBUG':
      return { 
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        icon: <span className="w-2 h-2 rounded-full bg-purple-400 mr-1" />
      };
    case 'WARN':
      return { 
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        icon: <span className="w-2 h-2 rounded-full bg-yellow-400 mr-1" />
      };
    case 'ERROR':
      return { 
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        icon: <span className="w-2 h-2 rounded-full bg-red-400 mr-1" />
      };
  }
};

export function BookUploader({ onBookLoaded }: BookUploaderProps) {
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
  const currentProgressRef = useRef(0);
  const [showFileInfo, setShowFileInfo] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [subTaskProgress, setSubTaskProgress] = useState<{[key: string]: number}>({});
  const logEndRef = useRef<HTMLDivElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 记录任务起始时间
  const uploadStartTime = useRef<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timeInterval = useRef<NodeJS.Timeout | null>(null);

  const logTopRef = useRef<HTMLDivElement>(null);

  // 添加日志按钮引用和位置状态
  const logButtonRef = useRef<HTMLDivElement>(null);
  const [logPosition, setLogPosition] = useState({ top: 0, right: 0 });
  
  // 在点击时计算日志窗口位置
  const toggleLogs = () => {
    if (logButtonRef.current) {
      const rect = logButtonRef.current.getBoundingClientRect();
      setLogPosition({
        top: rect.bottom + window.scrollY + 10, // 按钮下方10px
        right: window.innerWidth - rect.right + window.scrollX // 对齐右侧
      });
    }
    setShowLogs(prev => !prev);
  };

  // 自动滚动日志到底部
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // 修改：滚动到日志顶部而不是底部(因为是倒序显示)
  useEffect(() => {
    if (logTopRef.current && showLogs) {
      logTopRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  // 计时器
  useEffect(() => {
    if (isUploading && uploadStartTime.current) {
      timeInterval.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - uploadStartTime.current!) / 1000));
      }, 1000);
    }
    
    return () => {
      if (timeInterval.current) {
        clearInterval(timeInterval.current);
      }
    };
  }, [isUploading]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (timeInterval.current) {
        clearInterval(timeInterval.current);
      }
    };
  }, []);

  // 模拟添加后端日志
  const addLog = (level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev, {
      level,
      message,
      timestamp: new Date().toISOString()
    }]);
  };

  // 平滑更新进度
  const updateProgress = (target: number, taskKey?: string) => {
    if (taskKey) {
      // 更新子任务进度
      setSubTaskProgress(prev => ({
        ...prev,
        [taskKey]: target
      }));
    }

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
        const increment = Math.min(0.5, (target - prev) * 0.08); // 增加速度
        const newProgress = Math.min(target, prev + increment);
        return Math.round(newProgress * 10) / 10;
      });
    }, 30); // 更频繁更新
  };

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleFile = async (file: File) => {
    try {
      // 重置所有状态
      setSelectedFile(file);
      setShowFileInfo(true);
      setLogs([]);
      setSubTaskProgress({});
      setUploadProgress(0);
      setUploadStatus('pending');
      setUploadError(null);
      uploadStartTime.current = Date.now();
      setElapsedTime(0);

      // 添加初始日志
      addLog('INFO', `开始处理文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      addLog('DEBUG', '初始化上传环境...');

      // 并行开始验证和解析过程
      const [arrayBuffer, { data: { session } }] = await Promise.all([
        file.arrayBuffer(),
        supabase.auth.getSession()
      ]);

      if (!session?.access_token) {
        setUploadStatus('error');
        setUploadError('请先登录');
        addLog('ERROR', '认证失败: 未找到有效会话');
        throw new Error('请先登录');
      }

      addLog('INFO', '用户身份验证成功');
      addLog('DEBUG', '开始解析EPUB文件结构...');
      
      // 短暂展示文件信息
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setShowFileInfo(false);
      setIsUploading(true);
      setUploadProgress(10);
      setUploadStage('准备上传');
      setUploadDetail(`正在读取文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

      // 解析EPUB (10-30%)
      const localBook = await parseEpub(file) as LocalBook;
      setTotalChapters(localBook.chapters.length);
      setUploadStage('解析完成');
      setUploadDetail(`解析完成: 《${localBook.title}》 - ${localBook.author}\n共 ${localBook.chapters.length} 章节`);
      updateProgress(30);
      
      addLog('INFO', `EPUB解析完成: 《${localBook.title}》 by ${localBook.author}`);
      addLog('DEBUG', `检测到 ${localBook.chapters.length} 个章节`);
      
      if (localBook.resources?.imageFiles?.length) {
        addLog('DEBUG', `检测到 ${localBook.resources.imageFiles.length} 个图像资源`);
      }

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
      addLog('INFO', '开始第1阶段: 用户验证和书籍初始化');
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
        const errorText = await stage1Response.text();
        addLog('ERROR', `验证阶段失败: ${errorText}`);
        throw new Error('验证失败');
      }

      const stage1Data = await stage1Response.json();
      setUploadProgress(stage1Data.progress);
      const { bookId, userId } = stage1Data;
      addLog('INFO', `阶段1完成: 创建书籍ID ${bookId.substring(0, 8)}...`);

      // 3. 上传EPUB文件 (10-40%)
      setUploadStage('上传EPUB文件');
      setUploadDetail(`正在上传EPUB文件: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      updateProgress(20);
      addLog('INFO', '开始第2阶段: 上传EPUB文件');
      addLog('DEBUG', `准备上传 ${(file.size / 1024 / 1024).toFixed(2)}MB 数据到云存储`);
      
      // 添加子任务
      setSubTaskProgress(prev => ({
        ...prev,
        'epub': 0
      }));

      const stage2FormData = new FormData();
      stage2FormData.append('stage', '2');
      stage2FormData.append('bookId', bookId);
      stage2FormData.append('userId', userId);
      stage2FormData.append('file', file);
      stage2FormData.append('bookData', JSON.stringify(uploadData));

      // 模拟EPUB文件上传进度
      const epubUploadInterval = setInterval(() => {
        setSubTaskProgress(prev => {
          const current = prev['epub'] || 0;
          if (current >= 100) {
            clearInterval(epubUploadInterval);
            return prev;
          }
          return {
            ...prev,
            'epub': Math.min(100, current + Math.random() * 5)
          };
        });
      }, 100);

      const stage2Response = await fetch('/api/books/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: stage2FormData
      });

      clearInterval(epubUploadInterval);
      setSubTaskProgress(prev => ({...prev, 'epub': 100}));

      if (!stage2Response.ok) {
        const errorText = await stage2Response.text();
        addLog('ERROR', `EPUB上传失败: ${errorText}`);
        throw new Error('上传EPUB文件失败');
      }

      const stage2Data = await stage2Response.json();
      setUploadProgress(stage2Data.progress);
      const { book } = stage2Data;
      setUploadDetail('EPUB文件上传完成，准备处理资源...');
      updateProgress(40);
      addLog('INFO', 'EPUB文件上传成功');
      addLog('DEBUG', `存储路径: ${book.epub_path}`);

      // 4. 处理资源文件 (40-70%)
      setUploadStage('处理资源文件');
      addLog('INFO', '开始第3阶段: 处理图像资源');
      
      const stage3FormData = new FormData();
      stage3FormData.append('stage', '3');
      stage3FormData.append('bookId', bookId);
      stage3FormData.append('userId', userId);
      stage3FormData.append('file', file);
      stage3FormData.append('bookData', JSON.stringify(uploadData));

      // 创建多个并行模拟上传的任务
      const taskCount = Math.min(5, imageCount); // 最多5个并行任务
      const imagesPerTask = Math.ceil(imageCount / taskCount);
      
      // 添加子任务
      let taskKeys = [];
      for (let t = 0; t < taskCount; t++) {
        const taskKey = `images-${t}`;
        taskKeys.push(taskKey);
        setSubTaskProgress(prev => ({
          ...prev,
          [taskKey]: 0
        }));
      }

      // 并行模拟资源处理
      if (imageCount > 0) {
        // 启动并行模拟任务
        const taskIntervals = taskKeys.map((key, idx) => {
          return setInterval(() => {
            const startImg = idx * imagesPerTask;
            const endImg = Math.min(startImg + imagesPerTask, imageCount);
            const total = endImg - startImg;
            
            setSubTaskProgress(prev => {
              const current = prev[key] || 0;
              // 随机增量，但确保不同任务有不同的进度，模拟并行处理
              const increment = Math.random() * 3 * (1 + (idx % 3));
              if (current >= 100) {
                return prev;
              }
              return {
                ...prev,
                [key]: Math.min(100, current + increment)
              };
            });
          }, 100 + idx * 30); // 错开时间，更自然
        });

        for (let i = 0; i < imageCount; i++) {
          setCurrentImage(i + 1);
          setUploadDetail(`正在处理图片资源 (${i + 1}/${imageCount})`);
          updateProgress(40 + (i + 1) * (20 / imageCount));
          
          const taskIdx = Math.floor(i / imagesPerTask);
          const taskKey = taskKeys[taskIdx];
          
          if (i % Math.ceil(imageCount / 10) === 0 || i === imageCount - 1) {
            addLog('DEBUG', `处理图像资源 ${i + 1}/${imageCount}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 30));
        }

        // 清理所有间隔
        taskIntervals.forEach(interval => clearInterval(interval));
        
        // 确保所有任务都完成
        for (const key of taskKeys) {
          setSubTaskProgress(prev => ({
            ...prev,
            [key]: 100
          }));
        }
      }

      const stage3Response = await fetch('/api/books/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: stage3FormData
      });

      if (!stage3Response.ok) {
        const errorText = await stage3Response.text();
        addLog('ERROR', `处理资源失败: ${errorText}`);
        throw new Error('处理资源文件失败');
      }

      const stage3Data = await stage3Response.json();
      const { resources } = stage3Data;
      setUploadDetail(`图片资源处理完成: ${imageCount} 个文件`);
      updateProgress(70);
      addLog('INFO', `图像资源处理完成: ${imageCount} 个文件`);

      // 5. 处理章节内容 (70-95%)
      setUploadStage('处理章节内容');
      addLog('INFO', '开始第4阶段: 处理章节内容');
      
      // 添加章节处理任务
      const chapterTaskCount = Math.min(3, localBook.chapters.length); // 最多3个并行处理
      const chaptersPerTask = Math.ceil(localBook.chapters.length / chapterTaskCount);
      
      // 添加子任务
      let chapterTaskKeys = [];
      for (let t = 0; t < chapterTaskCount; t++) {
        const taskKey = `chapters-${t}`;
        chapterTaskKeys.push(taskKey);
        setSubTaskProgress(prev => ({
          ...prev,
          [taskKey]: 0
        }));
      }
      
      // 模拟并行章节处理
      const chapterIntervals = chapterTaskKeys.map((key, idx) => {
        return setInterval(() => {
          const startChapter = idx * chaptersPerTask;
          const endChapter = Math.min(startChapter + chaptersPerTask, localBook.chapters.length);
          
          setSubTaskProgress(prev => {
            const current = prev[key] || 0;
            // 随机增量，但确保不同任务有不同的进度
            const increment = Math.random() * 2 * (1 + (idx % 3));
            if (current >= 100) {
              return prev;
            }
            return {
              ...prev,
              [key]: Math.min(100, current + increment)
            };
          });
        }, 150 + idx * 50);
      });

      for (let i = 0; i < localBook.chapters.length; i++) {
        setCurrentChapter(i + 1);
        const chapter = localBook.chapters[i];
        setUploadDetail(`正在处理章节 ${i + 1}/${localBook.chapters.length}: ${chapter.title}`);
        updateProgress(70 + (i + 1) * (25 / localBook.chapters.length));
        
        const taskIdx = Math.floor(i / chaptersPerTask);
        const taskKey = chapterTaskKeys[taskIdx];
        
        if (i % Math.ceil(localBook.chapters.length / 5) === 0 || i === localBook.chapters.length - 1) {
          addLog('DEBUG', `处理章节 ${i + 1}/${localBook.chapters.length}: ${chapter.title.substring(0, 20)}${chapter.title.length > 20 ? '...' : ''}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 20));
      }
      
      // 清理所有间隔
      chapterIntervals.forEach(interval => clearInterval(interval));
      
      // 确保所有任务都完成
      for (const key of chapterTaskKeys) {
        setSubTaskProgress(prev => ({
          ...prev,
          [key]: 100
        }));
      }

      // 整合资源阶段 (95-99.9%)
      setUploadStage('整合资源');
      setUploadDetail('正在整合数据...');
      updateProgress(95);
      addLog('INFO', '整合章节和资源数据...');

      // 添加整合任务
      setSubTaskProgress(prev => ({
        ...prev,
        'finalize': 0
      }));

      // 加快进度更新速度
      const finalProgressInterval = setInterval(() => {
        const current = currentProgressRef.current;
        if (current < 99.8) {
          // 增加每次更新的幅度
          const next = current + (99.9 - current) * 0.3;
          currentProgressRef.current = next;
          updateProgress(next);
          
          // 同时更新整合子任务
          setSubTaskProgress(prev => ({
            ...prev,
            'finalize': Math.min(100, (next - 95) * 20) // 95-100% 映射到 0-100%
          }));
        }
      }, 300);

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

        if (!stage4Response.ok) {
          const errorText = await stage4Response.text();
          addLog('ERROR', `整合数据失败: ${errorText}`);
          throw new Error('整合数据失败');
        }

        const stage4Data = await stage4Response.json();
        
        // 完成上传 (100%)
        setUploadStage('上传完成');
        setUploadDetail(`上传成功：《${localBook.title}》\n共 ${localBook.chapters.length} 章节，${imageCount} 个资源文件`);
        updateProgress(100);
        setSubTaskProgress(prev => ({
          ...prev,
          'finalize': 100
        }));
        setUploadStatus('success');
        
        addLog('INFO', `✓ 书籍上传完成: 《${localBook.title}》`);
        addLog('INFO', `总耗时: ${formatTime(Math.floor((Date.now() - uploadStartTime.current!) / 1000))}`);

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
          chapters: stage4Data.chapters || [],
          // 添加缺少的必需属性
          type: 'book' as const,
          status: book.status || 'ready',
          note_count: stage4Data.chapters?.length || 0
        };

        onBookLoaded(mergedBook, arrayBuffer);
      } finally {
        clearInterval(finalProgressInterval);
      }

    } catch (error: any) {
      console.error('上传失败:', error);
      setShowFileInfo(false);
      setUploadDetail(`错误: ${error.message || '上传失败'}`);
      setUploadStatus('error');
      setUploadError(error.message || '上传失败');
      addLog('ERROR', `上传失败: ${error.message || '未知错误'}`);
      toast.error(error.message || '上传失败');
    } finally {
      setTimeout(() => {
        if (progressInterval.current) {
          clearInterval(progressInterval.current);
        }
        if (timeInterval.current) {
          clearInterval(timeInterval.current);
        }
        if (uploadStatus !== 'success' && uploadStatus !== 'error') {
          setIsUploading(false);
          setUploadProgress(0);
          setUploadStage('');
          setUploadDetail('');
          setCurrentChapter(0);
          setCurrentImage(0);
          setTotalImages(0);
          setTotalChapters(0);
          setSubTaskProgress({});
          setUploadStatus('idle');
        }
      }, 1000);
    }
  };

  return (
    <div className="w-full">
      {isUploading ? (
        <div className="w-full p-6 md:p-8 rounded-lg relative overflow-hidden min-h-[280px] border-2 border-dashed border-muted">
          {/* 背景图案 */}
          <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent)] opacity-50">
            <GridPattern />
          </div>
          
          <div className="relative z-10 space-y-6">
            {/* 状态横幅 */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {uploadStatus === 'pending' && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {uploadStatus === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {uploadStatus === 'error' && (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="text-lg font-medium text-neutral-700 dark:text-neutral-300">
                  {uploadStage}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                {/* 日志指示器 - 使用ref获取位置 */}
                {logs.length > 0 && (
                  <div ref={logButtonRef} className="relative">
                    {/* 最新日志，点击可展开/收起日志窗口 */}
                    {(() => {
                      const latestLog = logs[logs.length - 1];
                      const style = getLogStyle(latestLog.level);
                      return (
                        <div 
                          onClick={toggleLogs}
                          className={`${style.bgColor} rounded px-2 py-1 flex items-center gap-2 text-xs cursor-pointer hover:opacity-90 transition-opacity max-w-[280px] mr-2`}
                        >
                          <span className={`${style.color} text-[10px] font-bold flex items-center gap-0.5 whitespace-nowrap`}>
                            {style.icon} {latestLog.level}
                          </span>
                          <span className="text-neutral-700 dark:text-neutral-300 truncate">{latestLog.message}</span>
                          
                          <span className="ml-1 text-[10px] flex items-center justify-center bg-black/20 dark:bg-white/20 rounded-full w-4 h-4 flex-shrink-0">
                            {logs.length}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
                
                {/* 计时器和进度指示器 */}
                <div className="text-sm font-medium bg-black/5 dark:bg-white/5 backdrop-blur-sm px-2 py-1 rounded">
                  {formatTime(elapsedTime)}
                </div>
                
                <span className="text-lg font-semibold text-primary">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
            </div>

            {/* 主进度条 - 修复光效 */}
            <div className="w-full bg-white/10 dark:bg-neutral-800/50 rounded-full h-3 overflow-hidden backdrop-blur-sm relative">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
              
              {/* 修复进度条光效 - 使用纯CSS解决方案 */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-ltr"
                style={{ 
                  clipPath: uploadProgress < 99 ? `inset(0 ${100 - uploadProgress}% 0 0)` : 'none',
                  display: uploadProgress < 99 ? 'block' : 'none'
                }}
              />
            </div>

            {/* 详细信息面板 */}
            {uploadDetail && (
              <div className="flex flex-col gap-3 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-lg p-4 border border-neutral-200 dark:border-neutral-800">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {uploadDetail}
                </span>

                {/* 任务进度网格 - 使用蓝色进度条 */}
                {Object.keys(subTaskProgress).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                    {Object.entries(subTaskProgress).map(([key, progress]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                          <span>
                            {key.startsWith('images-') ? `图像组 ${parseInt(key.split('-')[1]) + 1}` : 
                             key.startsWith('chapters-') ? `章节组 ${parseInt(key.split('-')[1]) + 1}` :
                             key === 'epub' ? '上传EPUB' : 
                             key === 'finalize' ? '数据整合' : key}
                          </span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${progress >= 100 ? 'bg-green-500/70' : 'bg-blue-500/60'} transition-all duration-300`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              
                {/* 图片和章节处理进度并排显示 - 使用蓝色进度条 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* 图片处理进度 */}
                  {currentImage > 0 && totalImages > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                        <span>处理图片资源</span>
                        <span>{currentImage}/{totalImages}</span>
                      </div>
                      <div className="h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500/60 transition-all duration-300"
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
                      <div className="h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500/60 transition-all duration-300"
                          style={{ width: `${(currentChapter / totalChapters) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 上传完成或错误显示 */}
            {uploadStatus === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/10 border border-green-500/20 rounded-md p-3 flex items-center gap-3"
              >
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">上传成功</p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    书籍已成功上传，正在跳转到阅读视图...
                  </p>
                </div>
              </motion.div>
            )}
            
            {uploadStatus === 'error' && uploadError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-md p-3 flex items-center gap-3"
              >
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">上传失败</p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {uploadError}
                  </p>
                </div>
              </motion.div>
            )}
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
              
              <div className="mt-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary/60" />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  EPUB电子书 - 正在检查内容结构...
                </p>
              </div>
              
              <div className="mt-3">
                <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ 
                      width: ["0%", "40%", "70%", "90%"],
                      transition: { 
                        times: [0, 0.3, 0.6, 1],
                        duration: 2,
                        ease: "easeInOut"
                      }
                    }}
                    className="h-full bg-blue-400/60 dark:bg-blue-500/60"
                  />
                </div>
              </div>
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

      {/* 使用Portal渲染日志窗口，避免影响布局 */}
      {typeof window !== 'undefined' && showLogs && createPortal(
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed z-[1000] bg-black/80 backdrop-blur-md text-white/90 rounded-md p-3 border border-white/10 overflow-hidden w-80 md:w-96 max-h-[350px] font-mono text-xs shadow-xl custom-scrollbar"
          style={{
            top: `${logPosition.top}px`,
            right: `${logPosition.right}px`
          }}
        >
          <div className="flex items-center justify-between sticky top-0 bg-black/90 p-1.5 border-b border-white/20 mb-2 z-10">
            <span className="text-white/80 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" /> 上传日志记录
            </span>
            <div className="flex items-center gap-3">
              <span className="text-white/70 text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">
                {logs.length} 条
              </span>
              <button
                onClick={() => setShowLogs(false)}
                className="text-white/50 hover:text-white/90 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          
          <div className="custom-scrollbar overflow-y-auto pr-2 max-h-[280px]">
            <div ref={logTopRef} />
            {/* 倒序显示日志 */}
            {[...logs].reverse().map((log, index) => {
              const style = getLogStyle(log.level);
              return (
                <div 
                  key={index}
                  className={`${style.bgColor} rounded-md px-2.5 py-1.5 flex items-center gap-2 mb-1.5`}
                >
                  <span className={`${style.color} text-xs font-bold flex items-center gap-1 flex-shrink-0`}>
                    {style.icon} {log.level}
                  </span>
                  <span className="text-white/90 text-xs break-words">{log.message}</span>
                </div>
              );
            })}
          </div>
        </motion.div>,
        document.body
      )}

      {/* 要在样式表中添加闪光动画 */}
      <style jsx global>{`
        @keyframes shimmer-rtl {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        @keyframes shimmer-ltr {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer-rtl {
          animation: shimmer-rtl 2s infinite;
        }
        .animate-shimmer-ltr {
          animation: shimmer-ltr 2s infinite;
        }
        
        /* 自定义滚动条样式 */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
}