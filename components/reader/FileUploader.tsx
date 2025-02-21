'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { parseEpub } from '@/lib/epub-parser';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

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

  const handleFile = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStage('准备上传');

      // 1. 本地解析EPUB (0-10%)
      const arrayBuffer = await file.arrayBuffer();
      setUploadProgress(5);
      const localBook = await parseEpub(file) as LocalBook;
      setUploadProgress(10);
      setUploadStage('解析完成');

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

      // 2. 第一阶段：验证用户和初始化 (10-30%)
      setUploadStage('验证用户');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('请先登录');
      }

      const formData = new FormData();
      formData.append('stage', '1');
      formData.append('file', file);
      formData.append('bookData', JSON.stringify(uploadData));

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

      // 3. 第二阶段：上传EPUB文件和基本信息 (30-50%)
      setUploadStage('上传EPUB文件');
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

      // 4. 第三阶段：处理资源文件 (50-70%)
      setUploadStage('处理资源文件');
      const stage3FormData = new FormData();
      stage3FormData.append('stage', '3');
      stage3FormData.append('bookId', bookId);
      stage3FormData.append('userId', userId);
      stage3FormData.append('file', file);
      stage3FormData.append('bookData', JSON.stringify(uploadData));

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
      setUploadProgress(stage3Data.progress);
      const { resources } = stage3Data;

      // 5. 第四阶段：处理章节内容 (70-100%)
      setUploadStage('处理章节内容');
      const stage4FormData = new FormData();
      stage4FormData.append('stage', '4');
      stage4FormData.append('bookId', bookId);
      stage4FormData.append('userId', userId);
      stage4FormData.append('bookData', JSON.stringify(uploadData));

      const stage4Response = await fetch('/api/books/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: stage4FormData
      });

      if (!stage4Response.ok) {
        throw new Error('处理章节内容失败');
      }

      const stage4Data = await stage4Response.json();
      setUploadProgress(stage4Data.progress);
      const { chapters } = stage4Data;

      // 完成上传
      setUploadStage('上传完成');
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
        chapters: chapters || []
      };

      onBookLoaded(mergedBook, arrayBuffer);

    } catch (error: any) {
      console.error('上传失败:', error);
      toast.error(error.message || '上传失败');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-12 text-center ${
        isDragging ? 'border-primary bg-primary/5' : 'border-muted'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-primary/10 rounded-full">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">上传电子书</h2>
        {isUploading ? (
          <div className="w-full space-y-4">
            <div className="w-full bg-accent/10 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{uploadStage}</span>
              <span>{uploadProgress}%</span>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
            拖放 EPUB 文件到这里，或者
            <label className="text-primary cursor-pointer ml-1">
              点击上传
              <input
                type="file"
                className="hidden"
                accept=".epub"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                disabled={isUploading}
              />
            </label>
          </p>
        )}
      </div>
    </div>
  );
}