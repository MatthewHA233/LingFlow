import { supabase } from '@/lib/supabase-client';

export interface AlignmentResult {
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

export class SpeechRecognitionService {
  // 保存识别结果到数据库
  static async saveRecognitionResults(speechId: string, results: AlignmentResult) {
    if (!speechId) {
      throw new Error('缺少speechId');
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
        order: index + 1
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
      }).filter(Boolean);

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
  }

  // 执行语音识别
  static async recognize(audioUrl: string, speechId: string) {
    if (!audioUrl || !speechId) {
      throw new Error('缺少必要参数');
    }

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
        audioUrl,
        storageFormat: 'json',
        speechId
      })
    });

    if (!alignRes.ok) {
      const errorData = await alignRes.json();
      throw new Error(errorData.error || '识别失败');
    }

    console.log('收到识别响应');
    const result = await alignRes.json();
    console.log('识别结果:', result);

    // 保存识别结果到数据库
    await this.saveRecognitionResults(speechId, result);

    return result;
  }
} 