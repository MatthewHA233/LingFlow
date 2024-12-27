'use client';

import { useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { parseEpub } from '@/lib/epub-parser';
import { Book } from '@/types/book';

interface FileUploaderProps {
  onBookLoaded: (book: Book) => void;
}

export function FileUploader({ onBookLoaded }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    try {
      const book = await parseEpub(file);
      onBookLoaded(book);
    } catch (error) {
      console.error('Error parsing book:', error);
      // TODO: Add proper error handling
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-12 text-center ${
        isDragging ? 'border-primary bg-primary/5' : 'border-muted'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-primary/10 rounded-full">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">上传电子书</h2>
        <p className="text-muted-foreground">
          拖放 EPUB 文件到这里，或者
          <label className="text-primary cursor-pointer ml-1">
            点击上传
            <input
              type="file"
              className="hidden"
              accept=".epub"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </p>
      </div>
    </div>
  );
}