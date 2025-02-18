'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { AudioRecognizer } from '@/components/reader/AudioRecognizer';
import { Book } from '@/types/book';

interface AudioReaderPageProps {
  params: {
    id: string;
  };
}

export default function AudioReaderPage({ params }: AudioReaderPageProps) {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBook() {
      try {
        const { data: book, error } = await supabase
          .from('books')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;
        setBook(book);
      } catch (err: any) {
        console.error('加载书籍失败:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadBook();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">
          {error || '找不到该书籍'}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">{book.title}</h1>
          {book.author && (
            <p className="text-muted-foreground">作者: {book.author}</p>
          )}
        </div>

        <AudioRecognizer
          bookContent={JSON.stringify(book.chapters)}
          bookId={book.id}
        />
      </div>
    </div>
  );
} 