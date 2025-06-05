import { useState, useRef, useEffect } from 'react';
import { FileAudio, Upload, Wand2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { SpeechRecognitionService } from '@/lib/services/speech-recognition';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Dispatch, SetStateAction } from 'react';

export interface AudioUploaderProps {
  bookId: string;
  onUploadSuccess: (newAudioUrl: string, newSpeechId: string) => Promise<void>;
  onUploadError: (error: string) => void;
  isOpen: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
  isProcessing?: boolean;
}

export function AudioUploader({ bookId, onUploadSuccess, onUploadError, isOpen, onOpenChange }: AudioUploaderProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed'>('idle');
  const abortControllerRef = useRef<AbortController | null>(null);

  // 处理对话框关闭
  const handleOpenChange = (open: boolean) => {
    if (!open && (status === 'uploading' || status === 'processing')) {
      // 如果正在处理中，不允许关闭
      return;
    }
    
    // 如果有正在进行的请求，中断它
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    onOpenChange?.(open);
    
    // 重置状态
    if (!open) {
      setStatus('idle');
      setAudioFile(null);
    }
  };

  const handleUpload = async () => {
    if (!audioFile || !bookId) return;
    
    try {
      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();
      
      setStatus('uploading');
      
      const uploadForm = new FormData();
      uploadForm.append('file', audioFile);
      uploadForm.append('bookId', bookId);
      
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const userId = session.data.session?.user.id;
      
      if (!token || !userId) {
        throw new Error('未登录');
      }
      
      const uploadRes = await fetch('/api/audio/upload', {
        method: 'POST',
        body: uploadForm,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || '上传失败');
      }
      
      const uploadData = await uploadRes.json();
      
      // 2. 创建 speech_results 记录
      const { data: speechResult, error: speechError } = await supabase
        .from('speech_results')
        .insert({
          task_id: uploadData.speechId,
          audio_url: uploadData.fileLink,
          user_id: userId,
          book_id: bookId,
          status: 'uploaded'
        })
        .select()
        .single();
        
      if (speechError) {
        throw speechError;
      }

      // 3. 开始识别
      setStatus('processing');
      await SpeechRecognitionService.recognize(uploadData.fileLink, speechResult.id);

      // 4. 轮询检查识别状态
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const { data: result, error } = await supabase
          .from('speech_results')
          .select('*')
          .eq('id', speechResult.id)
          .single();
          
        if (error) throw error;
        
        if (result.status === 'completed') {
          // 先设置为已完成状态，显示动画
          setStatus('completed');
          
          // 暂时禁用对话框关闭
          const originalOnOpenChange = onOpenChange;
          onOpenChange = () => {}; // 临时替换为空函数，阻止关闭
          
          try {
            // 等待完成动画显示完（至少2秒）
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            // 动画显示完毕后，再通知父组件
      onUploadSuccess(uploadData.fileLink, speechResult.id);
      setAudioFile(null);
            
            // 恢复原来的关闭处理函数
            onOpenChange = originalOnOpenChange;
            setStatus('idle');
            onOpenChange?.(false);
          } catch (e) {
            // 恢复原来的关闭处理函数
            onOpenChange = originalOnOpenChange;
            throw e;
          }
          
          return;
        } else if (result.status === 'error') {
          throw new Error(result.error_message || '识别失败');
        }
        
        // 等待2秒后继续轮询
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
      
      throw new Error('识别超时');
      
    } catch (error: any) {
      console.error('上传失败:', error);
      // 区分不同类型的错误
      if (error.code === 'PGRST204') {
        onUploadError('数据库操作失败');
      } else if (error.message.includes('未登录')) {
        onUploadError('请先登录');
      } else {
      onUploadError(error.message || '上传失败');
      }
    } finally {
      if (status !== 'completed') {
        setStatus('idle');
      }
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      setAudioFile(null);
      setStatus('idle');
    };
  }, []);

    return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>上传音频</DialogTitle>
          <DialogDescription>请选择要上传的音频文件，支持 MP3、WAV 格式</DialogDescription>
        </DialogHeader>
        
        {status === 'processing' ? (
          <div className="space-y-4">
            <HoverBorderGradient
              containerClassName="w-full rounded-lg"
              className="w-full flex flex-col items-center justify-center gap-4 py-8"
            >
              <Wand2 className="h-8 w-8 animate-pulse text-primary" />
              <div className="text-sm flex items-center gap-1">
                <span>正在智慧识别</span>
                <span className="relative w-4">
                  <span className="absolute animate-bounce-dots">...</span>
                </span>
              </div>
              <div className="w-full max-w-[200px] h-1 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-progress-indeterminate" />
              </div>
            </HoverBorderGradient>
          </div>
        ) : status === 'completed' ? (
          <HoverBorderGradient
            containerClassName="w-full rounded-lg"
            className="w-full flex flex-col items-center justify-center py-8 space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-primary animate-in zoom-in duration-300" />
            </div>
            <p className="text-sm text-muted-foreground animate-in fade-in-50 duration-500">识别完成</p>
          </HoverBorderGradient>
        ) : (
          !audioFile ? (
            <HoverBorderGradient
              containerClassName="w-full rounded-lg"
              className="w-full flex flex-col items-center gap-4 p-6 cursor-pointer"
            >
              <label className="w-full flex flex-col items-center gap-4 cursor-pointer">
        <FileAudio className="h-8 w-8 text-primary" />
        <span className="text-muted-foreground">点击或拖拽音频文件到此处</span>
        <input
          type="file"
          className="hidden"
                  accept="audio/mp3,audio/wav"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
                      if (file.size > 100 * 1024 * 1024) {
                        onUploadError('文件大小不能超过100MB');
                        return;
                      }
              setAudioFile(file);
            }
          }}
        />
      </label>
            </HoverBorderGradient>
          ) : (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileAudio className="h-4 w-4" />
        <span>{audioFile.name}</span>
        <span className="text-xs">({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
      </div>
      <div className="flex justify-between items-center gap-4">
        <button
          className={`flex items-center gap-2 px-4 py-2 ${
                    status === 'uploading' ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary'
          } text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors`}
          onClick={handleUpload}
                  disabled={status === 'uploading'}
        >
                  {status === 'uploading' ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              <span>正在上传...</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>开始上传</span>
            </>
          )}
        </button>
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setAudioFile(null)}
                  disabled={status === 'uploading'}
        >
          取消
        </button>
      </div>
    </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
} 