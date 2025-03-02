'use client';

import { useState, useEffect } from 'react';
import { Wand2, Upload, X, AlignCenter } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { SentencePlayer } from './SentencePlayer';
import { AudioUploader } from './AudioUploader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime } from '@/lib/utils/date';
import { SpeechRecognitionService, AlignmentResult } from '@/lib/services/speech-recognition';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Button } from '@/components/ui/button';

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
  const [showUploader, setShowUploader] = useState(false);  // 添加上传界面显示状态
  const [isAlignMode, setIsAlignMode] = useState(false);

  // 加载书籍的所有音频记录
  useEffect(() => {
    async function loadBookAudios() {
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
      loadBookAudios();
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
    setAudioUrl(newAudioUrl);
    onAudioUrlChange?.(newAudioUrl);
    setSpeechId(newSpeechId);
    setStatus('completed');
    setShowUploader(false);  // 上传成功后隐藏上传界面
    
    // 重新加载音频记录列表
    const { data: newResults } = await supabase
      .from('speech_results')
      .select('*')
      .eq('book_id', bookId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
      
    if (newResults) {
      setSpeechResults(newResults);
      // 自动选择最新上传的音频
      const latestResult = newResults[0];
      if (latestResult) {
        setAudioUrl(latestResult.audio_url);
        onAudioUrlChange?.(latestResult.audio_url);
        setSpeechId(latestResult.id);
      }
    }
    
    // 自动开始识别
    handleRecognition(newAudioUrl, newSpeechId);
  };

  const handleUploadError = (error: string) => {
    setStatus('error');
    setErrorMessage(error);
  };

  // 处理语音识别
  const handleRecognition = async (audioUrlToUse?: string, speechIdToUse?: string) => {
    const currentAudioUrl = audioUrlToUse || audioUrl;
    const currentSpeechId = speechIdToUse || speechId;
    
    setStatus('processing');
    setErrorMessage('');
    
    try {
      await SpeechRecognitionService.recognize(currentAudioUrl, currentSpeechId);
      setStatus('completed');
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* 音频记录选择器和上传按钮 */}
      <div className="flex flex-col gap-4 p-4">
        {/* 历史记录选择器 */}
        {(speechResults.length > 0 || status === 'completed') && (
          <div className="w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">历史记录</h3>
              <HoverBorderGradient
                containerClassName="rounded-full"
                onClick={() => setShowUploader(!showUploader)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary/10 hover:bg-primary/15 transition-colors"
              >
                <Upload className="w-3 h-3" />
                <span>上传新音频</span>
              </HoverBorderGradient>
            </div>
            {!showUploader && (
              <Select
                value={speechId}
                onValueChange={handleAudioChange}
              >
                <SelectTrigger className="w-full h-9 border-muted-foreground/20">
                  <SelectValue placeholder="选择历史音频记录" />
                </SelectTrigger>
                <SelectContent>
                  {speechResults.map((result) => (
                    <SelectItem 
                      key={result.id} 
                      value={result.id}
                    >
                      {formatDateTime(result.created_at, 'yyyy-MM-dd HH:mm')} 的音频
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* 上传组件 */}
        {(showUploader || (!speechResults.length && status !== 'completed')) && (
          <div className="w-full">
            {showUploader && (
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">上传音频</h3>
                <button 
                  onClick={() => setShowUploader(false)}
                  className="text-xs text-muted-foreground hover:text-foreground p-1 rounded-md"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <AudioUploader
              bookId={bookId}
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
            />
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {errorMessage && (
        <div className="mx-4 p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-sm">
          {errorMessage}
        </div>
      )}

      {/* 音频处理区域 */}
      {audioUrl && (
        <div className="space-y-4 px-4">
          {/* 智慧语音识别按钮 - 仅在未识别时显示 */}
          {status !== 'completed' && (
            <HoverBorderGradient
              containerClassName="w-full rounded-lg"
              onClick={() => status !== 'processing' && handleRecognition()}
              className={`w-full flex items-center justify-center gap-2 py-2 ${
                status === 'processing' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Wand2 className="h-4 w-4" />
              {status === 'processing' ? '识别中...' : '智慧语音识别'}
            </HoverBorderGradient>
          )}

          {/* 句子播放器 - 传递对齐模式状态和切换函数 */}
          {speechId && status === 'completed' && (
            <div className="border-t pt-3 mt-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">逐句点读</h3>
                
                {/* 将按钮从SentencePlayer移到这里 */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      // 通过事件通知SentencePlayer切换状态
                      window.dispatchEvent(new CustomEvent('toggle-hide-aligned'));
                    }}
                    className="flex items-center gap-0.5 text-xs px-1.5 py-1 rounded-md bg-accent/30 hover:bg-accent/50 transition-all duration-300"
                    title="隐藏已对齐句子"
                  >
                    <span className="inline-block w-2 h-2 rounded-full mr-1 bg-foreground"></span>
                    <span className="text-xs">仅未对齐</span>
                  </button>
                  
                  <button
                    onClick={toggleAlignMode}
                    className={`flex items-center gap-0.5 text-xs px-1.5 py-1 rounded-md transition-all duration-300 ${
                      isAlignMode 
                        ? 'bg-primary/15 text-primary' 
                        : 'bg-accent/30 hover:bg-accent/50 text-foreground'
                    }`}
                    title={isAlignMode ? "退出文本对齐模式" : "开始文本对齐"}
                  >
                    <AlignCenter className={`h-3 w-3 ${isAlignMode ? 'animate-pulse' : ''}`} />
                    <span className="text-xs">{isAlignMode ? "退出对齐" : "语境块对齐"}</span>
                  </button>
                </div>
              </div>
              <div className="bg-background/50 rounded-md border border-border/50">
                <SentencePlayer
                  speechId={speechId}
                  onTimeChange={setCurrentTime}
                  currentTime={currentTime}
                  isAlignMode={isAlignMode}
                  onToggleAlignMode={toggleAlignMode}
                />
              </div>
            </div>
          )}

          {/* 处理状态显示 */}
          {status === 'processing' && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-b-transparent"></div>
              正在识别语音内容，请稍候...
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
