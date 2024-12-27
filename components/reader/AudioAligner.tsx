'use client';

import { useState } from 'react';
import { FileAudio, Wand2 } from 'lucide-react';
import { alignAudio } from '@/lib/audio-aligner';

interface AudioAlignerProps {
  bookContent: string;
}

export function AudioAligner({ bookContent }: AudioAlignerProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isAligning, setIsAligning] = useState(false);

  const handleAlignment = async () => {
    if (!audioFile) return;
    
    setIsAligning(true);
    try {
      const alignment = await alignAudio(audioFile, bookContent);
      // TODO: Handle the alignment result
    } catch (error) {
      console.error('Error aligning audio:', error);
    } finally {
      setIsAligning(false);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">音频对齐</h2>
      {!audioFile ? (
        <label className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg cursor-pointer">
          <FileAudio className="h-8 w-8 text-primary" />
          <span className="text-muted-foreground">上传音频文件</span>
          <input
            type="file"
            className="hidden"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setAudioFile(file);
            }}
          />
        </label>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{audioFile.name}</p>
          <button
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2"
            onClick={handleAlignment}
            disabled={isAligning}
          >
            <Wand2 className="h-4 w-4" />
            {isAligning ? '正在对齐...' : '开始音文对齐'}
          </button>
        </div>
      )}
    </div>
  );
}