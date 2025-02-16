'use client';

import { useState } from 'react';
import { FileAudio, Wand2 } from 'lucide-react';
import { alignAudio } from '@/lib/audio-aligner';

interface AudioAlignerProps {
  bookContent: string;
}

interface AlignmentResult {
  status: string;
  results: Array<{
    BeginTime: number;
    EndTime: number;
    Text: string;
    SpeechRate?: number;
    EmotionValue?: number;
  }>;
  words: Array<{
    Word: string;
    BeginTime: number;
    EndTime: number;
    Confidence: number;
  }>;
}

export function AudioAligner({ bookContent }: AudioAlignerProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isAligning, setIsAligning] = useState(false);
  const [alignmentData, setAlignmentData] = useState<AlignmentResult>({
    status: '',
    results: [],
    words: []
  });

  const handleAlignment = async () => {
    if (!audioFile) return
    
    setIsAligning(true)
    try {
      // 1. 上传到OSS
      const uploadForm = new FormData()
      uploadForm.append('file', audioFile)
      
      const uploadRes = await fetch('/api/audio/upload', {
        method: 'POST',
        body: uploadForm
      })
      
      const uploadText = await uploadRes.text()
      if (!uploadRes.ok) {
        throw new Error(`上传失败 (${uploadRes.status}): ${uploadText}`)
      }
      
      let uploadData
      try {
        uploadData = JSON.parse(uploadText)
      } catch (e) {
        throw new Error(`解析上传响应失败: ${uploadText}`)
      }
      
      const { fileLink } = uploadData

      // 2. 启动语音识别
      const alignRes = await fetch('/api/proxy/python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: fileLink,
          storageFormat: 'json'
        })
      })

      const alignText = await alignRes.text()
      if (!alignRes.ok) {
        throw new Error(`识别失败 (${alignRes.status}): ${alignText}`)
      }

      let result
      try {
        result = JSON.parse(alignText)
      } catch (e) {
        throw new Error(`解析识别结果失败: ${alignText}`)
      }

      setAlignmentData(result)
      
    } catch (error: any) {
      console.error('完整错误:', error)
      setAlignmentData({
        status: 'ERROR',
        results: [],
        words: [{
          Word: `处理失败: ${error.message}`,
          BeginTime: 0,
          EndTime: 0,
          Confidence: 0
        }]
      })
    } finally {
      setIsAligning(false)
    }
  }

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

          {alignmentData.results.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="font-medium">识别结果:</h3>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {alignmentData.results.map((segment, index) => (
                  <div 
                    key={index}
                    className="p-2 bg-muted rounded text-sm"
                  >
                    <span className="text-muted-foreground">
                      {formatTime(segment.BeginTime)} - {formatTime(segment.EndTime)}
                    </span>
                    <p>{segment.Text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
}