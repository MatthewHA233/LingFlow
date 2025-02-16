'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/reader/FileUploader';
import { EbookViewer } from '@/components/reader/EbookViewer';
import { AudioAligner } from '@/components/reader/AudioAligner';
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

export default function ReaderPage() {
  const [book, setBook] = useState<Book | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);

  const handleBookLoaded = (loadedBook: Book, buffer: ArrayBuffer) => {
    setBook(loadedBook);
    setArrayBuffer(buffer);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">有声书导入</h1>
        
        {!book ? (
          <FileUploader onBookLoaded={handleBookLoaded} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <EbookViewer book={book} arrayBuffer={arrayBuffer!} />
            </div>
            <div>
              <AudioAligner bookContent={JSON.stringify(serializeBook(book))} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}