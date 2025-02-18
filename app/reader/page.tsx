'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/reader/FileUploader';
import { ReaderContent } from '@/components/reader/ReaderContent';
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
        {!book ? (
          <>
            <h1 className="text-2xl font-bold mb-8">有声书导入</h1>
            <FileUploader onBookLoaded={handleBookLoaded} />
          </>
        ) : (
          <ReaderContent book={book} arrayBuffer={arrayBuffer!} />
        )}
      </div>
    </div>
  );
}