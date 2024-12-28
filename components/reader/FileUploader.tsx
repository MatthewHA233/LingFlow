'use client';

import { useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { parseEpub } from '@/lib/book-parser/epub-parser';
import { ParsedBook } from '@/lib/book-parser/types';
import { useToast } from '@/hooks/use-toast';

interface FileUploaderProps {
  onBookLoaded: (book: ParsedBook) => void;
}

export function FileUploader({ onBookLoaded }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.epub')) {
      toast({
        title: "不支持的文件格式",
        description: "目前仅支持 EPUB 格式的电子书",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const book = await parseEpub(file);
      onBookLoaded(book);
      toast({
        title: "电子书解析成功",
        description: `已成功解析《${book.metadata.title}》并生成章节文件`,
      });
    } catch (error) {
      toast({
        title: "解析失败",
        description: error instanceof Error ? error.message : "解析电子书时发生错误",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
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
        {isLoading && (
          <p className="text-muted-foreground">正在解析电子书...</p>
        )}
      </div>
    </div>
  );
}