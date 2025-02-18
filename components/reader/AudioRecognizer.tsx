'use client';

import { useState, useEffect } from 'react';
import { FileAudio, Wand2, Upload } from 'lucide-react';
import { alignAudio } from '@/lib/audio-aligner';
import { supabase } from '@/lib/supabase-client';
import { AudioPlayer } from './AudioPlayer';
import { SentencePlayer } from './SentencePlayer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime } from '@/lib/utils/date';

interface AudioRecognizerProps {
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

export function AudioRecognizer({ bookContent, bookId }: AudioRecognizerProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [speechId, setSpeechId] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [alignmentData, setAlignmentData] = useState<AlignmentResult>({
    status: '',
    results: [],
    words: []
  });
  const [speechResults, setSpeechResults] = useState<SpeechResult[]>([]);

  // 加载书籍的所有音频记录
  useEffect(() => {
    async function loadBookAudios() {
      console.log('开始加载音频记录, bookId:', bookId);
      try {
        const { data, error } = await supabase
          .from('speech_results')
          .select('*')
          .eq('book_id', bookId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false });

        console.log('音频记录数据:', data, '错误:', error);

        if (error) {
          console.error('加载音频记录失败:', error);
          return;
        }

        setSpeechResults(data || []);
        
        // 如果有记录，自动选择最新的一条
        if (data && data.length > 0) {
          const latestResult = data[0];
          console.log('选择最新音频记录:', latestResult);
          setAudioUrl(latestResult.audio_url);
          setSpeechId(latestResult.id);
          setStatus('completed');
        }
      } catch (err) {
        console.error('加载音频记录失败:', err);
      }
    }

    if (bookId) {
      loadBookAudios();
    }
  }, [bookId]);

  // 处理音频切换
  const handleAudioChange = (resultId: string) => {
    console.log('切换音频记录:', resultId);
    const selectedResult = speechResults.find(r => r.id === resultId);
    if (selectedResult) {
      console.log('选中的音频记录:', selectedResult);
      setAudioUrl(selectedResult.audio_url);
      setSpeechId(selectedResult.id);
      setStatus('completed');
    }
  };

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
          book_id: bookId,
          status: 'uploaded'
        })
        .select()
        .single();
        
      if (speechError) {
        console.error('创建语音记录失败:', speechError);
        throw speechError;
      }

      console.log('创建语音记录成功:', speechResult);
      
      setAudioUrl(uploadData.fileLink);
      setSpeechId(speechResult.id);
      setStatus('completed');  // 上传完成后设置状态为 completed
      
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
      console.log('开始保存识别结果, speechId:', speechId);
      
      // 更新 speech_results 状态为处理中
      const { error: updateError } = await supabase
        .from('speech_results')
        .update({ status: 'processing' })
        .eq('id', speechId);

      if (updateError) throw updateError;

      // 准备批量插入的句子数据
      const sentencesData = results.results.map((result, index) => ({
        speech_id: speechId,
        begin_time: Math.round(result.BeginTime),
        end_time: Math.round(result.EndTime),
        text_content: result.Text,
        speech_rate: result.SpeechRate || null,
        emotion_value: result.EmotionValue || null,
        order: index + 1  // 添加 order 字段
      }));

      console.log('准备插入句子数据:', sentencesData);

      // 批量插入句子
      const { data: sentences, error: sentencesError } = await supabase
        .from('sentences')
        .insert(sentencesData)
        .select();

      if (sentencesError) {
        console.error('插入句子数据失败:', sentencesError);
        throw sentencesError;
      }

      console.log('成功插入句子数据:', sentences);

      // 准备词数据
      const wordsData = results.words.map(word => {
        // 找到包含这个词的句子
        const sentence = sentences.find(s => 
          word.BeginTime >= s.begin_time && 
          word.EndTime <= s.end_time
        );
        
        if (sentence) {
          return {
            sentence_id: sentence.id,
            word: word.Word.trim(),
            begin_time: Math.round(word.BeginTime),
            end_time: Math.round(word.EndTime)
          };
        }
        return null;
      }).filter(Boolean);  // 移除 null 值

      console.log('准备插入单词数据:', wordsData);

      // 批量插入词
      if (wordsData.length > 0) {
        const { data: words, error: wordsError } = await supabase
          .from('words')
          .insert(wordsData)
          .select();

        if (wordsError) {
          console.error('插入单词数据失败:', wordsError);
          throw wordsError;
        }

        console.log('成功插入单词数据:', words);
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

  // 修改语音识别函数，接受参数
  const handleRecognition = async (audioUrlToUse?: string, speechIdToUse?: string) => {
    const currentAudioUrl = audioUrlToUse || audioUrl;
    const currentSpeechId = speechIdToUse || speechId;
    
    console.log('开始语音识别, 参数:', {
      audioUrl: currentAudioUrl,
      speechId: currentSpeechId
    });
    
    if (!currentAudioUrl || !currentSpeechId) {
      console.error('缺少必要参数:', {
        audioUrl: currentAudioUrl,
        speechId: currentSpeechId
      });
      return;
    }
    
    setStatus('processing');
    setErrorMessage('');
    
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('未登录');
      }

      console.log('发送识别请求...');
      const alignRes = await fetch('/api/proxy/python', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          audioUrl: currentAudioUrl,
          storageFormat: 'json',
          speechId: currentSpeechId
        })
      });

      if (!alignRes.ok) {
        const errorData = await alignRes.json();
        throw new Error(errorData.error || '识别失败');
      }

      console.log('收到识别响应');
      const result = await alignRes.json();
      console.log('识别结果:', result);
      
      setAlignmentData(result);
      
      // 保存识别结果到数据库
      console.log('开始保存识别结果...');
      await saveRecognitionResults(result);
      console.log('保存识别结果完成');
      
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
    <div className="bg-card rounded-lg shadow-lg p-6 space-y-6">
      <h2 className="text-xl font-semibold mb-4">音频处理</h2>
      
      {/* 音频记录选择器 */}
      {speechResults.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">选择音频记录</label>
          <Select
            value={speechId}
            onValueChange={handleAudioChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择音频记录" />
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
        </div>
      )}

      {/* 错误提示 */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {errorMessage}
        </div>
      )}

      {!audioFile && !audioUrl ? (
        <label className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg cursor-pointer">
          <FileAudio className="h-8 w-8 text-primary" />
          <span className="text-muted-foreground">上传新的音频文件</span>
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
        <div className="space-y-6">
          {audioFile && (
            <p className="text-sm text-muted-foreground">{audioFile.name}</p>
          )}
          
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
            <>
              {/* 音频播放器 */}
              <AudioPlayer
                bookId={bookId}
                audioUrl={audioUrl}
                onTimeUpdate={(time) => setCurrentTime(time)}
                currentTime={currentTime}
              />

              {/* 智慧语音识别按钮 */}
              <div className="mt-6">
                <button
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2"
                  onClick={() => handleRecognition()}
                  disabled={status === 'processing'}
                >
                  <Wand2 className="h-4 w-4" />
                  {status === 'processing' ? '识别中...' : '智慧语音识别'}
                </button>
              </div>

              {/* 句子播放器 */}
              {speechId && status === 'completed' && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">逐句点读</h3>
                  <div className="text-sm text-muted-foreground mb-4">
                    当前音频ID: {speechId}
                  </div>
                  <SentencePlayer
                    speechId={speechId}
                    onTimeChange={setCurrentTime}
                  />
                </div>
              )}
            </>
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