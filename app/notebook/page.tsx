'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/card';
import { BookUploader } from '@/components/content/BookUploader';
import { ReaderContent } from '@/components/content/ReaderContent';
import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

export default function NotebookPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const [book, setBook] = useState<Book | null>(null);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [loadingNotebooks, setLoadingNotebooks] = useState(true);

  useEffect(() => {
    // 如果用户已加载完成且没有登录，则重定向到首页
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function loadNotebooks() {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('notebooks')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('updated_at', { ascending: false });

        if (error) throw error;
        setNotebooks(data || []);
      } catch (error) {
        console.error('加载笔记本失败:', error);
        toast.error('加载笔记本失败');
      } finally {
        setLoadingNotebooks(false);
      }
    }

    if (user) {
      loadNotebooks();
    }
  }, [user]);

  const handleCreateNotebook = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notebooks')
        .insert([{
          title: '新笔记本',
          description: '',
          user_id: user.id,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      // 跳转到新创建的笔记本
      router.push(`/notebook/${data.id}`);
      toast.success('笔记本创建成功');
    } catch (error) {
      console.error('创建笔记本失败:', error);
      toast.error('创建笔记本失败');
    }
  };

  // 用户正在加载中，显示加载状态
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">正在检查登录状态...</div>
      </div>
    );
  }

  // 用户没有登录，显示错误信息
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold mb-2">需要登录</h1>
            <p className="text-muted-foreground">请先登录后再访问笔记本</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {!book ? (
          <>
            <h1 className="text-2xl font-bold mb-8">笔记本管理</h1>
            <div className="grid gap-4">
              <button 
                onClick={handleCreateNotebook}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
              >
                + 创建新笔记本
              </button>
              
              {loadingNotebooks ? (
                <div className="text-center py-8">加载中...</div>
              ) : (
                <div className="grid gap-4">
                  {notebooks.map(notebook => (
                    <Card key={notebook.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" 
                          onClick={() => router.push(`/notebook/${notebook.id}`)}>
                      <h3 className="font-semibold">{notebook.title}</h3>
                      <p className="text-sm text-muted-foreground">{notebook.description || '暂无描述'}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        更新于 {new Date(notebook.updated_at).toLocaleDateString()}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <ReaderContent book={book} />
        )}
      </div>
    </div>
  );
} 