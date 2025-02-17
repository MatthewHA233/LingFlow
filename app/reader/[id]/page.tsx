'use client';

import { useEffect, useState } from 'react';
import { ReaderContent } from '@/components/reader/ReaderContent';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';

interface ReaderPageProps {
  params: {
    id: string;
  };
}

export default function ReaderPage({ params }: ReaderPageProps) {
  const [book, setBook] = useState<Book | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    async function loadBook() {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        // 获取书籍数据
        const { data: bookData, error: bookError } = await supabase
          .from('books')
          .select(`
            *,
            chapters (*, order_index)
          `)
          .eq('id', params.id)
          .single();

        if (bookError) throw bookError;

        if (!bookData) {
          setError('未找到书籍');
          return;
        }

        // 确保章节按顺序排列
        const sortedBook = {
          ...bookData,
          chapters: bookData.chapters?.sort((a: { order_index: number }, b: { order_index: number }) => 
            a.order_index - b.order_index
          ) || []
        };

        // 获取书籍资源
        const { data: resources, error: resourceError } = await supabase
          .from('book_resources')
          .select('*')
          .eq('book_id', params.id);

        if (resourceError) throw resourceError;

        // 获取EPUB文件
        const response = await fetch(sortedBook.epub_path);
        if (!response.ok) throw new Error('无法加载电子书文件');
        
        const arrayBuffer = await response.arrayBuffer();

        setBook({
          ...sortedBook,
          resources: {
            manifest: resources?.reduce((acc: any, resource) => {
              acc[resource.id] = {
                href: resource.original_path,
                'media-type': resource.mime_type,
                oss_url: resource.oss_path
              };
              return acc;
            }, {}) || {}
          }
        });
        
        // 保存到组件状态
        setArrayBuffer(arrayBuffer);
      } catch (error: any) {
        console.error('加载书籍失败:', error);
        setError(error.message || '加载书籍失败');
      } finally {
        setLoading(false);
      }
    }

    loadBook();
  }, [params.id, user, router]);

  if (!user) {
    return null; // 等待路由跳转
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg">正在加载书籍...</div>
        </div>
      </div>
    );
  }

  if (error || !book || !arrayBuffer) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg text-red-500">{error || '加载失败'}</div>
        </div>
      </div>
    );
  }

  return <ReaderContent book={book} arrayBuffer={arrayBuffer} />;
} 