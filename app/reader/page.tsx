'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/reader/FileUploader';
import { EbookViewer } from '@/components/reader/EbookViewer';
import { AudioAligner } from '@/components/reader/AudioAligner';
import { Book } from '@/types/book';

export default function ReaderPage() {
  const [book, setBook] = useState<Book | null>(null);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {!book ? (
          <FileUploader onBookLoaded={setBook} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <EbookViewer book={book} />
            </div>
            <div>
              <AudioAligner bookContent={book.content} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}