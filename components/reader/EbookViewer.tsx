'use client';

import { Book } from '@/types/book';
import { AudioPlayer } from './AudioPlayer';

interface EbookViewerProps {
  book: Book;
  audioUrl?: string;
}

export function EbookViewer({ book, audioUrl }: EbookViewerProps) {
  return (
    <div className="space-y-6">
      {/* 音频播放器 */}
      {audioUrl && (
        <AudioPlayer coverUrl={book.coverUrl} audioUrl={audioUrl} />
      )}
      
      {/* 电子书内容 */}
      <div className="bg-card rounded-lg shadow-lg p-8 min-h-[800px]">
        <div className="flex items-center gap-4 mb-6">
          {book.coverUrl && (
            <img 
              src={book.coverUrl} 
              alt={book.title} 
              className="w-16 h-16 rounded-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">{book.title}</h1>
            {book.author && (
              <p className="text-muted-foreground">{book.author}</p>
            )}
          </div>
        </div>
        <div className="prose prose-sm max-w-none">
          <div dangerouslySetInnerHTML={{ __html: book.content }} />
        </div>
      </div>
    </div>
  );
}