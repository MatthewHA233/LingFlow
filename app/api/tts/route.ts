import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createBigModelTTSService } from '@/lib/services/tts-service-bigmodel';
import { TTSSynthesizeOptions, VoiceType, AudioEncoding } from '@/types/tts';
import { rateLimit } from '@/lib/rate-limit';
import { uploadToOSS } from '@/lib/oss-client';

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// 设置速率限制器 - 每分钟10次请求（考虑到豆包API的并发限制）
const limiter = rateLimit({
  interval: 60 * 1000, // 1分钟
  uniqueTokenPerInterval: 500 // 最大用户数
});

// 令牌缓存
const tokenCache = new Map<string, {userId: string, expiry: number}>();

// 验证请求参数
interface TTSRequestBody {
  text: string;
  voiceType?: string;
  speedRatio?: number;
  format?: 'base64' | 'url';
  bookId?: string;  // 添加bookId用于保存到数据库
  // 大模型新增参数
  emotion?: string;
  enableEmotion?: boolean;
  emotionScale?: number;
  encoding?: AudioEncoding;
  rate?: number;
  loudnessRatio?: number;
  withTimestamp?: boolean;
  textType?: 'plain' | 'ssml';
  silenceDuration?: number;
  operation?: 'query' | 'submit';
  disableMarkdownFilter?: boolean;
  enableLatexTn?: boolean;
  explicitLanguage?: string;
  contextLanguage?: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let userId: string;
    
    // 检查令牌缓存
    const cachedData = tokenCache.get(token);
    const now = Date.now();
    
    if (cachedData && cachedData.expiry > now) {
      userId = cachedData.userId;
      console.log('使用缓存的令牌验证');
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        console.error('用户验证失败:', userError);
        tokenCache.delete(token); // 移除无效的缓存项
        return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });
      }
      
      userId = user.id;
      // 缓存令牌，设置5分钟过期
      tokenCache.set(token, { userId, expiry: now + 5 * 60 * 1000 });
      console.log('令牌验证成功并缓存');
    }

    // 2. 应用速率限制
    try {
      await limiter.check(req, 10, userId); // 每分钟10次请求限制
    } catch {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        { status: 429 }
      );
    }

    // 3. 解析请求体
    const body: TTSRequestBody = await req.json();
    const { 
      text, voiceType, speedRatio, format = 'base64', bookId,
      emotion, enableEmotion, emotionScale, encoding,
      rate, loudnessRatio, withTimestamp, textType,
      silenceDuration, operation, disableMarkdownFilter,
      enableLatexTn, explicitLanguage, contextLanguage
    } = body;

    // 4. 验证必需参数
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '缺少必需参数: text' },
        { status: 400 }
      );
    }

    // 5. 限制文本长度（UTF-8字节数）
    const textBytes = Buffer.from(text, 'utf8').length;
    if (textBytes > 1024) { // 文档要求最大1024字节（UTF-8编码）
      return NextResponse.json(
        { error: `文本长度超过限制（最大1024字节，当前${textBytes}字节）` },
        { status: 400 }
      );
    }

    // 6. 验证音色类型
    if (voiceType && !Object.values(VoiceType).includes(voiceType as VoiceType)) {
      return NextResponse.json(
        { error: '不支持的音色类型' },
        { status: 400 }
      );
    }

    // 7. 验证语速比例
    if (speedRatio !== undefined && (speedRatio < 0.8 || speedRatio > 2.0)) {
      return NextResponse.json(
        { error: '语速比例必须在 0.8 到 2.0 之间' },
        { status: 400 }
      );
    }

    // 8. 验证情绪值
    if (emotionScale !== undefined && (emotionScale < 1 || emotionScale > 5)) {
      return NextResponse.json(
        { error: '情绪值必须在 1 到 5 之间' },
        { status: 400 }
      );
    }

    // 9. 验证音量比例
    if (loudnessRatio !== undefined && (loudnessRatio < 0.5 || loudnessRatio > 2.0)) {
      return NextResponse.json(
        { error: '音量比例必须在 0.5 到 2.0 之间' },
        { status: 400 }
      );
    }

    // 10. 初始化 TTS 服务
    const ttsConfig = {
      appid: process.env.DOUBAO_TTS_APPID!,
      token: process.env.DOUBAO_TTS_TOKEN!,
      cluster: 'volcano_tts',
      defaultVoiceType: VoiceType.ZH_MALE_CONVERSATION
    };
    
    // 调试日志
    console.log('豆包 TTS 配置:', {
      appid: ttsConfig.appid,
      hasToken: !!ttsConfig.token,
      tokenLength: ttsConfig.token?.length,
      cluster: ttsConfig.cluster
    });

    if (!ttsConfig.appid || !ttsConfig.token) {
      console.error('TTS 服务配置缺失');
      return NextResponse.json(
        { error: '服务配置错误，请联系管理员' },
        { status: 500 }
      );
    }

    const ttsService = createBigModelTTSService(ttsConfig);

    // 11. 合成语音
    const synthesizeOptions: TTSSynthesizeOptions = {
      text,
      voiceType: voiceType || ttsConfig.defaultVoiceType,
      speedRatio: speedRatio || 1.0,
      encoding: encoding || AudioEncoding.MP3,
      userId,
      // 大模型特有参数
      emotion,
      enableEmotion,
      emotionScale,
      rate,
      loudnessRatio,
      withTimestamp,
      textType,
      silenceDuration,
      operation: operation || 'query', // 默认非流式
      disableMarkdownFilter,
      enableLatexTn,
      explicitLanguage,
      contextLanguage
    };

    try {
      let result;
      
      // 始终返回 Base64 编码的音频数据，由前端创建 Blob URL
      const { audio, duration } = await ttsService.synthesizeToBase64(synthesizeOptions);
      
      // 12. 如果提供了bookId，则上传到OSS并保存到数据库
      if (bookId) {
        // 将base64转换为Buffer
        const audioBuffer = Buffer.from(audio, 'base64');
        
        // 生成文件名 - 使用完整的音色ID
        const voiceTypeId = voiceType || 'default';
        const timestamp = Date.now();
        const filename = `audio/${bookId}/TTS_${voiceTypeId}_${timestamp}.mp3`;
        
        // 上传到OSS
        const uploadResult = await uploadToOSS(audioBuffer, filename);
        const audioUrl = uploadResult.url;
        
        // 保存到数据库
        const { data: speechResult, error: createError } = await supabase
          .from('speech_results')
          .insert({
            task_id: `tts_${timestamp}`,
            audio_url: audioUrl,
            user_id: userId,
            book_id: bookId,
            name: `TTS - ${voiceTypeId} - ${new Date().toLocaleString('zh-CN')}`,
            duration: Math.round(duration / 1000), // 转换为秒
            status: 'completed',
            error_message: null
          })
          .select()
          .single();
          
        if (createError) {
          console.error('保存TTS结果失败:', createError);
          // 即使保存失败，仍然返回音频数据
        }
        
        result = {
          success: true,
          audioUrl: audioUrl,
          speechId: speechResult?.id || null,
          data: {
            audio,
            duration,
            format: 'base64',
            encoding: synthesizeOptions.encoding || AudioEncoding.MP3
          }
        };
        
        console.log(`TTS 合成并上传成功 - 用户: ${userId}, 文件: ${filename}, 时长: ${duration}ms`);
      } else {
        // 没有bookId，只返回音频数据
        result = {
          success: true,
          data: {
            audio,
            duration,
            format: 'base64',
            encoding: synthesizeOptions.encoding || AudioEncoding.MP3
          }
        };
        
        console.log(`TTS 合成成功 - 用户: ${userId}, 文本长度: ${text.length}, 音色: ${voiceType || '默认'}, 时长: ${result.data.duration}ms`);
      }

      return NextResponse.json(result);
      
    } catch (error) {
      console.error('TTS 合成失败:', error);
      
      // 区分不同类型的错误
      if (error instanceof Error) {
        // 详细打印错误信息
        console.error('TTS 错误详情:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        
        if (error.message.includes('超时')) {
          return NextResponse.json(
            { error: 'TTS 服务响应超时，请稍后再试' },
            { status: 504 }
          );
        } else if (error.message.includes('认证')) {
          return NextResponse.json(
            { error: 'TTS 服务认证失败' },
            { status: 401 }
          );
        } else if (error.message.includes('quota')) {
          return NextResponse.json(
            { error: '豆包 TTS 并发配额超限，请稍后再试' },
            { status: 429 }
          );
        } else if (error.message.includes('3001')) {
          return NextResponse.json(
            { error: '请求参数无效，请检查音色类型和文本内容' },
            { status: 400 }
          );
        } else if (error.message.includes('3011')) {
          return NextResponse.json(
            { error: '文本无效或与语种不匹配' },
            { status: 400 }
          );
        } else if (error.message.includes('3050')) {
          return NextResponse.json(
            { error: '音色不存在，请检查音色类型' },
            { status: 400 }
          );
        }
      }
      
      return NextResponse.json(
        { error: '语音合成失败，请稍后再试' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('TTS API 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}