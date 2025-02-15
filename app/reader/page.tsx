'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/reader/FileUploader';
import { EbookViewer } from '@/components/reader/EbookViewer';
import { AudioAligner } from '@/components/reader/AudioAligner';
import { Book } from '@/types/book';

export default function ReaderPage() {
  const [book, setBook] = useState<Book | null>(null);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">有声书导入</h1>
        
        {!book ? (
          <FileUploader onBookLoaded={setBook} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <EbookViewer book={book} />
            </div>
            <div>
              <AudioAligner book={book} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}