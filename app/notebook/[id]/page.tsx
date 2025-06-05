'use client';

import { useEffect, useState, useRef } from 'react';
import { Notebook, CustomPage } from '@/types/notebook';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase-client';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Plus, BookOpen, MoreHorizontal, Trash, Share, Edit, ArrowLeft, FileText, Clock, Eye, Calendar, PenTool } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { UnauthorizedTip } from '@/components/auth/UnauthorizedTip';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { toast } from 'sonner';
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card';
import { ReaderContent } from '@/components/content/ReaderContent';
import { Book } from '@/types/book';
import { useLoginDialog } from '@/hooks/use-login-dialog';

interface NotebookPageProps {
  params: {
    id: string;
  };
}

export default function NotebookPage({ params }: NotebookPageProps) {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notebookDataFetched, setNotebookDataFetched] = useState(false);
  const { user, loading: authLoading, checkRole } = useAuthStore();
  const router = useRouter();
  const { openLoginDialog } = useLoginDialog();

  useEffect(() => {
    if (notebookDataFetched) return;
    
    async function loadNotebook() {
      if (!authLoading && !user) {
        openLoginDialog();
        return;
      }
      
      if (authLoading || !user) return;
      
      try {
        setLoading(true);
        
        // 获取笔记本信息
        const { data: notebookData, error: notebookError } = await supabase
          .from('notebooks')
          .select('*')
          .eq('id', params.id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (notebookError) {
          if (notebookError.code === 'PGRST116') {
            setError('未找到笔记本');
            return;
          }
          throw notebookError;
        }

        if (!notebookData) {
          setError('未找到笔记本');
          return;
        }

        // 获取笔记本的页面（chapters相当于custom_pages）
        const { data: pagesData, error: pagesError } = await supabase
          .from('custom_pages')
          .select(`
            *,
            content_parents!custom_pages_parent_id_fkey (
              id,
              title,
              content_type,
              contextBlocks:context_blocks (*)
            )
          `)
          .eq('notebook_id', params.id)
          .order('order_index', { ascending: true });

        if (pagesError) throw pagesError;

        // 将笔记本数据转换为 Book 格式，以便复用 ReaderContent 组件
        const bookFormatData: Book = {
          id: notebookData.id,
          title: notebookData.title || '无标题笔记本',
          author: '', // 笔记本没有作者字段
          cover_url: notebookData.cover_url || undefined,
          epub_path: '', // 笔记本没有epub文件
          audio_path: '', // 笔记本没有音频文件
          user_id: notebookData.user_id,
          created_at: notebookData.created_at,
          updated_at: notebookData.updated_at,
          metadata: {
            notebook_description: notebookData.description || ''
          },
          chapters: (pagesData || []).map((page, index) => ({
            id: page.id,
            title: page.title,
            order_index: page.order_index || index,
            book_id: params.id,
            parent_id: page.parent_id || '',
            contentParent: page.content_parents ? {
              id: page.content_parents.id,
              content_type: page.content_parents.content_type,
              title: page.content_parents.title,
              description: page.content_parents.description,
              contextBlocks: page.content_parents.contextBlocks || []
            } : undefined
          })),
          resources: {
            manifest: {}
          }
        };

        setBook(bookFormatData);
        setNotebookDataFetched(true);
      } catch (error: any) {
        console.error('加载笔记本失败:', error);
        setError(error.message || '加载笔记本失败');
      } finally {
        setLoading(false);
      }
    }

    if (!notebookDataFetched) {
      loadNotebook();
    }
  }, [params.id, user, authLoading, notebookDataFetched, openLoginDialog, checkRole]);

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
          <div className="text-lg">正在加载笔记本...</div>
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

  return <ReaderContent book={book} />;
} 