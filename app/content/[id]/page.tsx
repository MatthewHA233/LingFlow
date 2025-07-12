'use client';

import { useEffect, useState } from 'react';
import { ReaderContent } from '@/components/content/ReaderContent';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { useAuthStore } from '@/stores/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLoginDialog } from '@/hooks/use-login-dialog';

interface ReaderPageProps {
  params: {
    id: string;
  };
}

export default function ReaderPage({ params }: ReaderPageProps) {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookDataFetched, setBookDataFetched] = useState(false);
  const { user, loading: authLoading, checkRole } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openLoginDialog } = useLoginDialog();

  // 获取URL中的blockId参数
  const targetBlockId = searchParams.get('blockId');

  useEffect(() => {
    if (bookDataFetched) return;
    
    async function loadBook() {
      if (!authLoading && !user) {
        openLoginDialog();
        return;
      }
      
      if (authLoading || !user) return;
      
      try {
        setLoading(true);
        
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
        
        const role = await checkRole();
        
        const hasPermission = role === 'admin' || bookData.user_id === user.id;
        if (!hasPermission) {
          setError('您没有权限访问此书籍');
          return;
        }

        const { data: resources, error: resourceError } = await supabase
          .from('book_resources')
          .select('*')
          .eq('book_id', params.id);

        if (resourceError) throw resourceError;

        const sortedBook = {
          ...bookData,
          chapters: bookData.chapters?.sort((a: { order_index: number }, b: { order_index: number }) => 
            a.order_index - b.order_index
          ) || [],
          resources: {
            manifest: resources?.reduce((acc, resource) => {
              acc[resource.id] = {
                href: resource.original_path,
                'media-type': resource.mime_type,
                oss_url: resource.oss_path
              };
              return acc;
            }, {}) || {}
          }
        };

        setBook(sortedBook);
        setBookDataFetched(true);
      } catch (error: any) {
        console.error('加载书籍失败:', error);
        setError(error.message || '加载书籍失败');
      } finally {
        setLoading(false);
      }
    }

    if (!bookDataFetched) {
      loadBook();
    }
  }, [params.id, user, authLoading, bookDataFetched, openLoginDialog, checkRole]);

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg">正在验证登录状态...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
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

  if (error || !book) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg text-red-500">{error || '加载失败'}</div>
        </div>
      </div>
    );
  }

  return <ReaderContent book={book} targetBlockId={targetBlockId} />;
} 