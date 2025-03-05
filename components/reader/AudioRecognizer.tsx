'use client';

import { useState, useEffect } from 'react';
import { Wand2, Upload, X, AlignCenter } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { SentencePlayer } from './SentencePlayer';
import { AudioUploader } from './AudioUploader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime } from '@/lib/utils/date';
import { SpeechRecognitionService } from '@/lib/services/speech-recognition';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from '@/lib/utils';

interface AudioRecognizerProps {
  bookContent: string;
  bookId: string;
  onAudioUrlChange?: (url: string) => void;
  onTimeChange?: (time: number) => void;
}

interface SpeechResult {
  id: string;
  audio_url: string;
  created_at: string;
  status: string;
  task_id: string;
  user_id: string;
  book_id: string;
}

// 添加处理状态类型
type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

export function AudioRecognizer({ 
  bookContent, 
  bookId,
  onAudioUrlChange,
  onTimeChange 
}: AudioRecognizerProps) {
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [speechId, setSpeechId] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [speechResults, setSpeechResults] = useState<SpeechResult[]>([]);
  const [isAlignMode, setIsAlignMode] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [hideAligned, setHideAligned] = useState(false);

  // 加载书籍的所有音频记录
  useEffect(() => {
    async function loadInitialData() {
      try {
        const { data, error } = await supabase
          .from('speech_results')
          .select('*')
          .eq('book_id', bookId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false });

        if (error) throw error;

        setSpeechResults(data || []);
        
        // 如果有记录，自动选择最新的一条
        if (data && data.length > 0) {
          const latestResult = data[0];
          setAudioUrl(latestResult.audio_url);
          onAudioUrlChange?.(latestResult.audio_url);
          setSpeechId(latestResult.id);
          setStatus('completed');
        }
      } catch (err) {
        console.error('加载音频记录失败:', err);
        setErrorMessage('加载音频记录失败');
      }
    }

    if (bookId) {
      loadInitialData();
    }
  }, [bookId, onAudioUrlChange]);

  // 监听 audioUrl 变化
  useEffect(() => {
    if (audioUrl) {
      onAudioUrlChange?.(audioUrl);
    }
  }, [audioUrl, onAudioUrlChange]);

  // 监听 currentTime 变化
  useEffect(() => {
    if (currentTime !== undefined) {
      onTimeChange?.(currentTime);
    }
  }, [currentTime, onTimeChange]);

  // 处理音频切换
  const handleAudioChange = (resultId: string) => {
    const selectedResult = speechResults.find(r => r.id === resultId);
    if (selectedResult) {
      // 先重置状态
      setCurrentTime(0);
      setSpeechId('');  // 先清空 speechId 触发重置
      
      // 然后设置新的音频
      setTimeout(() => {
        setAudioUrl(selectedResult.audio_url);
        onAudioUrlChange?.(selectedResult.audio_url);
        setSpeechId(selectedResult.id);
        setStatus('completed');
      }, 0);
    }
  };

  const handleUploadSuccess = async (newAudioUrl: string, newSpeechId: string) => {
    try {
      // 先更新状态
      setAudioUrl(newAudioUrl);
      onAudioUrlChange?.(newAudioUrl);
      setSpeechId(newSpeechId);
      setStatus('processing');
      
      // 等待识别完成
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const { data: result, error } = await supabase
          .from('speech_results')
          .select('*')
          .eq('id', newSpeechId)
          .single();
          
        if (error) throw error;
        
        if (result.status === 'completed') {
          // 重新加载最新的历史记录
          const { data: results, error: loadError } = await supabase
            .from('speech_results')
            .select('*')
            .eq('book_id', bookId)
            .eq('status', 'completed')
            .order('created_at', { ascending: false });

          if (loadError) throw loadError;
          
          // 更新历史记录
          setSpeechResults(results || []);
          setStatus('completed');
          
          // 等待2秒后关闭对话框
          await new Promise(resolve => setTimeout(resolve, 2000));
          setIsUploadDialogOpen(false);
          return;
        }
        
        // 等待2秒后继续检查
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
      
      throw new Error('识别超时');
      
    } catch (err) {
      console.error('处理失败:', err);
      setErrorMessage('处理失败');
      setStatus('error');
    }
  };

  const handleUploadError = (error: string) => {
    setStatus('error');
    setErrorMessage(error);
  };

  // 处理语音识别
  const handleRecognition = async (audioUrlToUse?: string, speechIdToUse?: string) => {
    const currentAudioUrl = audioUrlToUse || audioUrl;
    const currentSpeechId = speechIdToUse || speechId;
    
    if (status === 'processing') return; // 防止重复处理
    
    setStatus('processing');
    setErrorMessage('');
    
    try {
      // 识别过程
      await SpeechRecognitionService.recognize(currentAudioUrl, currentSpeechId);
      
      // 识别完成后更新状态
      setStatus('completed');
      
      // 重新加载最新的历史记录
      const { data: updatedResults } = await supabase
        .from('speech_results')
        .select('*')
        .eq('book_id', bookId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
        
      if (updatedResults) {
        setSpeechResults(updatedResults);
      }

      // 确保当前记录被选中
      setSpeechId(currentSpeechId);
      
    } catch (error: any) {
      console.error('识别失败:', error);
      setStatus('error');
      setErrorMessage(error.message || '识别失败');
    }
  };

  // 切换对齐模式
  const toggleAlignMode = () => {
    setIsAlignMode(!isAlignMode);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 错误提示 - 顶部 */}
      {errorMessage && (
        <div className="mx-4 p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-sm">
          {errorMessage}
        </div>
      )}

      {/* 音频处理区域 */}
      <div className="space-y-4 px-4 flex-1 flex flex-col">
        {/* 智慧语音识别/上传音频按钮 - 只在没有完成的记录时显示 */}
        {!speechId && (
          <HoverBorderGradient
            containerClassName="w-full rounded-lg mt-4"
            onClick={() => !status.startsWith('process') && setIsUploadDialogOpen(true)}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2 transition-all duration-300",
              status.startsWith('process') && "cursor-not-allowed"
            )}
          >
            {status.startsWith('process') ? (
              <>
                <Wand2 className="h-4 w-4 animate-pulse" />
                <span className="relative">
                  正在智慧识别
                  <span className="absolute -right-4 animate-bounce-dots">...</span>
                </span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                上传音频
              </>
            )}
          </HoverBorderGradient>
        )}

        {/* 上传对话框 */}
        <AudioUploader
          bookId={bookId}
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          isOpen={isUploadDialogOpen}
          onOpenChange={setIsUploadDialogOpen}
        />

        {/* 句子播放器和历史记录 */}
        {speechId && (
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                历史记录
              </h3>
              {status === 'completed' && (
                <Select
                  value={speechId}
                  onValueChange={handleAudioChange}
                >
                  <SelectTrigger className="w-32 h-6 text-xs border-muted-foreground/50">
                    <SelectValue placeholder="选择记录" />
                  </SelectTrigger>
                  <SelectContent>
                    {speechResults.map((result) => (
                      <SelectItem
                        key={result.id}
                        value={result.id}
                        className="text-xs"
                      >
                        {formatDateTime(result.created_at, 'MM-dd HH:mm')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="bg-background/50 rounded-md border border-border/50">
              <SentencePlayer
                speechId={speechId}
                onTimeChange={setCurrentTime}
                currentTime={currentTime}
                disabled={status === 'processing'}
              />
            </div>
          </div>
        )}
      </div>
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
