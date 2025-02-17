'use client';

import { useState } from 'react';
import { FileAudio, Wand2, Upload } from 'lucide-react';
import { alignAudio } from '@/lib/audio-aligner';
import { supabase } from '@/lib/supabase-client';

interface AudioAlignerProps {
  bookContent: string;
  bookId: string;
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

// 添加处理状态类型
type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

export function AudioAligner({ bookContent, bookId }: AudioAlignerProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [speechId, setSpeechId] = useState<string>('');
  const [alignmentData, setAlignmentData] = useState<AlignmentResult>({
    status: '',
    results: [],
    words: []
  });

  // 处理音频上传
  const handleUpload = async () => {
    if (!audioFile || !bookId) return;
    
    setStatus('uploading');
    setErrorMessage('');
    
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
          status: 'uploaded'
        })
        .select()
        .single();
        
      if (speechError) throw speechError;
      
      setAudioUrl(uploadData.fileLink);
      setSpeechId(speechResult.id);
      setStatus('completed');
      return uploadData.fileLink;
    } catch (error: any) {
      console.error('上传失败:', error);
      setStatus('error');
      setErrorMessage(error.message || '上传失败');
      throw error;
    }
  };

  // 保存识别结果到数据库
  const saveRecognitionResults = async (results: AlignmentResult) => {
    if (!speechId) {
      console.error('缺少speechId');
      return;
    }

    try {
      // 更新 speech_results 状态为处理中
      const { error: updateError } = await supabase
        .from('speech_results')
        .update({ status: 'processing' })
        .eq('id', speechId);

      if (updateError) throw updateError;

      // 准备批量插入的句子数据
      const sentencesData = results.results.map(result => ({
        speech_id: speechId,
        begin_time: Math.round(result.BeginTime),
        end_time: Math.round(result.EndTime),
        text_content: result.Text,
        speech_rate: result.SpeechRate || null,
        emotion_value: result.EmotionValue || null
      }));

      // 批量插入句子
      const { data: sentences, error: sentencesError } = await supabase
        .from('sentences')
        .insert(sentencesData)
        .select();

      if (sentencesError) throw sentencesError;

      // 准备词数据
      const wordsData = sentences.flatMap(sentence => {
        const sentenceWords = results.words.filter(
          word => word.BeginTime >= sentence.begin_time && 
                 word.EndTime <= sentence.end_time
        );
        
        return sentenceWords.map(word => ({
          sentence_id: sentence.id,
          word: word.Word,
          begin_time: Math.round(word.BeginTime),
          end_time: Math.round(word.EndTime)
        }));
      });

      // 批量插入词
      if (wordsData.length > 0) {
        const { error: wordsError } = await supabase
          .from('words')
          .insert(wordsData);

        if (wordsError) throw wordsError;
      }

      // 更新 speech_results 状态为完成
      await supabase
        .from('speech_results')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', speechId);

      console.log('识别结果保存完成');
    } catch (error: any) {
      console.error('保存识别结果失败:', error);
      // 更新 speech_results 状态为错误
      await supabase
        .from('speech_results')
        .update({ 
          status: 'error',
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', speechId);
      throw error;
    }
  };

  // 处理语音识别
  const handleRecognition = async () => {
    if (!audioUrl || !speechId) return;
    
    setStatus('processing');
    setErrorMessage('');
    
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('未登录');
      }

      const alignRes = await fetch('/api/proxy/python', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          audioUrl: audioUrl,
          storageFormat: 'json',
          speechId: speechId
        })
      });

      if (!alignRes.ok) {
        const errorData = await alignRes.json();
        throw new Error(errorData.error || '识别失败');
      }

      const result = await alignRes.json();
      setAlignmentData(result);
      
      // 保存识别结果到数据库
      await saveRecognitionResults(result);
      setStatus('completed');
      
    } catch (error: any) {
      console.error('识别失败:', error);
      setStatus('error');
      setErrorMessage(error.message || '识别失败');
      setAlignmentData({
        status: 'ERROR',
        results: [],
        words: []
      });
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">音频处理</h2>
      
      {/* 错误提示 */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {errorMessage}
        </div>
      )}

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
              if (file) {
                setAudioFile(file);
                setStatus('idle');
                setErrorMessage('');
              }
            }}
          />
        </label>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{audioFile.name}</p>
          
          {!audioUrl ? (
            <button
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2"
              onClick={handleUpload}
              disabled={status === 'uploading'}
            >
              <Upload className="h-4 w-4" />
              {status === 'uploading' ? '正在上传...' : '上传音频'}
            </button>
          ) : (
            <button
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2"
              onClick={handleRecognition}
              disabled={status === 'processing'}
            >
              <Wand2 className="h-4 w-4" />
              {status === 'processing' ? '正在识别...' : '智慧语音识别'}
            </button>
          )}

          {/* 处理状态显示 */}
          {status !== 'idle' && status !== 'error' && (
            <div className="text-sm text-muted-foreground">
              当前状态: {
                status === 'uploading' ? '上传中' :
                status === 'processing' ? '处理中' :
                status === 'completed' ? '已完成' : ''
              }
            </div>
          )}

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