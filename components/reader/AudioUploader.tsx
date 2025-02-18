import { useState } from 'react';
import { FileAudio, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

interface AudioUploaderProps {
  bookId: string;
  onUploadSuccess: (audioUrl: string, speechId: string) => void;
  onUploadError: (error: string) => void;
}

export function AudioUploader({ bookId, onUploadSuccess, onUploadError }: AudioUploaderProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!audioFile || !bookId) return;
    
    setIsUploading(true);
    
    try {
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
      
      // 创建 speech_results 记录
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

      onUploadSuccess(uploadData.fileLink, speechResult.id);
      setAudioFile(null);
      
    } catch (error: any) {
      console.error('上传失败:', error);
      onUploadError(error.message || '上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  if (!audioFile) {
    return (
      <label className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
        <FileAudio className="h-8 w-8 text-primary" />
        <span className="text-muted-foreground">点击或拖拽音频文件到此处</span>
        <input
          type="file"
          className="hidden"
          accept="audio/*"
          id="audio-upload"
          name="audio-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setAudioFile(file);
            }
          }}
        />
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileAudio className="h-4 w-4" />
        <span>{audioFile.name}</span>
        <span className="text-xs">({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
      </div>
      <div className="flex justify-between items-center gap-4">
        <button
          className={`flex items-center gap-2 px-4 py-2 ${
            isUploading ? 'bg-primary/50' : 'bg-primary'
          } text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors`}
          onClick={handleUpload}
          disabled={isUploading}
        >
          {isUploading ? (
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
          disabled={isUploading}
        >
          取消
        </button>
      </div>
    </div>
  );
} 