'use client';

import { useEffect, useState } from 'react';
import { Book } from '@/types/book';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function BookshelfPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    async function loadBooks() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        setBooks(data || []);
      } catch (error) {
        console.error('加载书架失败:', error);
      } finally {
        setLoading(false);
      }
    }

    loadBooks();
  }, [user]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">请先登录</h1>
          <p className="text-muted-foreground">登录后即可查看您的书架</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">我的书架</h1>
        <Link href="/reader">
          <Button>导入新书</Button>
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
            <Button>导入新书</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/reader/${book.id}`}
              className="group hover:opacity-80 transition-opacity"
            >
              <div className="relative aspect-[3/4] mb-3 bg-muted rounded-lg overflow-hidden">
                <Image
                  src={book.cover_url}
                  alt={book.title}
                  fill
                  className="object-cover"
                />
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