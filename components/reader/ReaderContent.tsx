'use client';

import { useState, useEffect } from 'react';
import { EbookViewer } from './EbookViewer';
import { AudioAligner } from './AudioAligner';
import { Book } from '@/types/book';
import { processChapterContent } from '@/lib/content-processor';
import { supabase } from '@/lib/supabase-client';

interface ReaderContentProps {
  book: Book;
  arrayBuffer: ArrayBuffer;
}

export function ReaderContent({ book, arrayBuffer }: ReaderContentProps) {
  const [currentChapter, setCurrentChapter] = useState(0);
  const [processedContent, setProcessedContent] = useState<string>('');
  const [resources, setResources] = useState<Array<{ original_path: string; oss_path: string }>>([]);

  // 加载资源信息
  useEffect(() => {
    async function loadResources() {
      const { data, error } = await supabase
        .from('book_resources')
        .select('original_path, oss_path')
        .eq('book_id', book.id);

      if (error) {
        console.error('加载资源信息失败:', error);
        return;
      }

      setResources(data || []);
    }

    loadResources();
  }, [book.id]);

  // 处理当前章节内容
  useEffect(() => {
    if (book.chapters[currentChapter]?.content && resources.length > 0) {
      const { content } = processChapterContent(
        book.chapters[currentChapter].content,
        resources
      );
      setProcessedContent(content);
    }
  }, [currentChapter, book.chapters, resources]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EbookViewer 
              book={book} 
              arrayBuffer={arrayBuffer}
              currentChapter={currentChapter}
              onChapterChange={setCurrentChapter}
              processedContent={processedContent}
            />
          </div>
          <div>
            <AudioAligner 
              bookContent={JSON.stringify({
                title: book.title,
                author: book.author,
                chapters: book.chapters.map(chapter => ({
                  title: chapter.title,
                  content: chapter.content
                }))
              })} 
              bookId={book.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 