'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { parseEpub } from '@/lib/epub-parser';
import { createClient } from '@supabase/supabase-js';
import { Book } from '@/types/book';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface FileUploaderProps {
  onBookLoaded: (book: Book, arrayBuffer: ArrayBuffer) => void;
}

interface Resource {
  href: string;
  'media-type'?: string;
  id?: string;
}

export function FileUploader({ onBookLoaded }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (file: File) => {
    try {
      setIsUploading(true);
      console.log('开始处理文件:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // 1. 先在本地解析EPUB
      console.log('开始本地解析EPUB');
      const arrayBuffer = await file.arrayBuffer();
      const localBook = await parseEpub(file);
      console.log('本地解析成功:', {
        title: localBook.title,
        chaptersCount: localBook.chapters.length
      });
      
      // 2. 获取当前会话
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('请先登录');
      }

      // 3. 准备上传数据
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookData', JSON.stringify({
        title: localBook.title,
        author: localBook.author,
        metadata: localBook.metadata,
        chapters: localBook.chapters.map(chapter => ({
          title: chapter.title,
          content: chapter.content
        })),
        resources: localBook.resources
      }));

      // 4. 上传到服务器
      const response = await fetch('/api/books/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '上传失败');
      }

      const { book: serverBook } = await response.json();
      
      // 5. 合并本地和服务器数据
      const mergedBook = {
        ...localBook,
        id: serverBook.id,
        user_id: serverBook.user_id,
        epub_path: serverBook.epub_path,
        cover_url: serverBook.cover_url,
        created_at: serverBook.created_at,
        updated_at: serverBook.updated_at
      };

      onBookLoaded(mergedBook, arrayBuffer);
    } catch (error: any) {
      console.error('完整错误:', error);
      alert(error.message || '上传失败');
    } finally {
      setIsUploading(false);
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
        <p className="text-muted-foreground">
          {isUploading ? (
            '正在上传...'
          ) : (
            <>
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
            </>
          )}
        </p>
      </div>
    </div>
  );
}