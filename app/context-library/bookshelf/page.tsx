'use client';

import { useEffect, useState } from 'react';
import { Book } from '@/types/book';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase-client';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Upload, BookOpen, Mail, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { UnauthorizedTip } from '@/components/auth/UnauthorizedTip';

export default function BookshelfPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [placeholderStates, setPlaceholderStates] = useState<Record<string, boolean>>({});
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const { user } = useAuthStore();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      router.refresh();
    } catch (error: any) {
      setLoginError(error.message || '登录失败，请重试');
    }
  };

  // 添加检查和更新封面的函数
  const checkAndUpdateCover = async (book: Book) => {
    if (!book.cover_url && user) {  // 添加 user 检查
      console.log('检查书籍封面:', book.id);
      try {
        const { data: resources, error } = await supabase
          .from('book_resources')
          .select('original_path, oss_path, resource_type, mime_type')
          .eq('book_id', book.id);

        if (error) {
          console.error('查询资源失败:', error);
          return book;
        }

        console.log('找到资源:', resources);

        // 查找可能的封面资源
        const coverResource = resources?.find(r => {
          const path = r.original_path.toLowerCase();
          // 只匹配包含 cover 的路径
          const isCover = 
            path.includes('cover') ||
            path.match(/^(?:OEBPS\/)?images?\/cover\./i) ||
            path.match(/^(?:OEBPS\/)?cover\./i);
          
          if (isCover) {
            console.log('找到封面资源:', {
              path: r.original_path,
              oss_path: r.oss_path,
              type: r.resource_type,
              mime: r.mime_type
            });
          }
          return isCover;
        });

        if (coverResource?.oss_path) {
          console.log('使用找到的封面资源:', coverResource);
          
          try {
            // 使用 API 端点更新封面 URL
            const response = await fetch('/api/books/update-cover', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
              },
              body: JSON.stringify({
                bookId: book.id,
                coverUrl: coverResource.oss_path
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error('更新封面URL失败:', errorData);
              return book;
            }

            const { book: updatedBook } = await response.json();
            return updatedBook;
          } catch (error) {
            console.error('更新封面URL失败:', error);
            return book;
          }
        } else {
          console.log('未找到合适的封面资源，尝试其他图片资源');
          // 如果没有找到明确的封面，使用第一个图片资源
          const firstImage = resources?.find(r => 
            r.resource_type === 'image' && r.mime_type?.startsWith('image/')
          );
          
          if (firstImage?.oss_path) {
            console.log('使用第一个图片资源作为封面:', firstImage);
            const { error: updateError } = await supabase
              .from('books')
              .update({ cover_url: firstImage.oss_path })
              .eq('id', book.id);

            if (updateError) {
              console.error('更新封面URL失败:', updateError);
              return book;
            }

            return { ...book, cover_url: firstImage.oss_path };
          }
        }
      } catch (error) {
        console.error('处理封面失败:', error);
      }
    }
    return book;
  };

  useEffect(() => {
    async function loadBooks() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('books')
          .select(`
            *,
            chapters (*, order_index)
          `)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        // 确保章节按顺序排列
        const booksWithSortedChapters = (data || []).map(book => ({
          ...book,
          chapters: book.chapters?.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index) || []
        }));

        // 检查并更新所有书籍的封面
        const updatedBooks = await Promise.all(
          booksWithSortedChapters.map(async (book) => await checkAndUpdateCover(book))
        );
        
        setBooks(updatedBooks);
      } catch (error) {
        console.error('加载书架失败:', error);
      } finally {
        setLoading(false);
      }
    }

    loadBooks();
  }, [user]);

  if (!user) {
    return <UnauthorizedTip />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">我的书架</h1>
        <Link href="/reader">
          <HoverBorderGradient
            containerClassName="rounded-full"
            className="flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" />
            <span>导入新书</span>
          </HoverBorderGradient>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-[240px] w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">您的书架还是空的</h2>
          <p className="text-muted-foreground mb-4">导入您的第一本有声书开始阅读之旅吧</p>
          <Link href="/reader">
            <HoverBorderGradient
              containerClassName="rounded-full mx-auto"
              className="flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>开始导入</span>
            </HoverBorderGradient>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {books.map((book, index) => (
            <Link
              key={book.id}
              href={`/reader/${book.id}`}
              className="group hover:opacity-80 transition-opacity"
            >
              <div className="relative aspect-[3/4] mb-3 bg-muted rounded-lg overflow-hidden [&.placeholder-active_.placeholder-content]:block">
                {book.cover_url ? (
                  <>
                    <Image
                      src={book.cover_url}
                      alt={book.title}
                      width={240}
                      height={320}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        try {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          img.parentElement?.classList.add('placeholder-active');
                          setPlaceholderStates(prev => ({...prev, [book.id]: true}));
                        } catch (error) {
                          console.error('处理封面失败:', error);
                          setPlaceholderStates(prev => ({...prev, [book.id]: true}));
                        }
                      }}
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (!img.complete) {
                          setPlaceholderStates(prev => ({...prev, [book.id]: true}));
                        }
                      }}
                    />
                    <div className={`placeholder-content absolute inset-0 w-full h-full items-center justify-center bg-muted ${
                      placeholderStates[book.id] ? 'flex' : 'hidden'
                    }`}>
                      <div className="text-muted-foreground text-sm text-center p-4">
                        {book.title}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <div className="text-muted-foreground text-sm text-center p-4">
                      {book.title}
                    </div>
                  </div>
                )}
                {book.progress && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${book.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <h3 className="font-medium line-clamp-1">{book.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {book.author}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 