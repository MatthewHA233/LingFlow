'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/card';
import { BookUploader } from '@/components/content/BookUploader';
import { ReaderContent } from '@/components/content/ReaderContent';
import { Book } from '@/types/book';

// 创建一个安全的序列化函数
const serializeBook = (book: Book) => {
  return {
    title: book.title,
    author: book.author,
    chapters: book.chapters.map(chapter => ({
      title: chapter.title,
      content: chapter.content
    }))
  };
};

export default function ReadingPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const [book, setBook] = useState<Book | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    // 如果用户已加载完成且没有登录，则重定向到首页
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleBookLoaded = (loadedBook: Book, buffer: ArrayBuffer) => {
    setBook(loadedBook);
    setArrayBuffer(buffer);
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
            <p className="text-muted-foreground">请先登录后再访问阅读器</p>
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
            <h1 className="text-2xl font-bold mb-8">有声书导入</h1>
            <BookUploader onBookLoaded={handleBookLoaded} />
          </>
        ) : (
          <ReaderContent book={book} />
        )}
      </div>
    </div>
  );
}