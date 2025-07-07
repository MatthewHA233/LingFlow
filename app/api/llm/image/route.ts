import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

export async function POST(req: Request) {
  try {
    const { 
      prompt, 
      size = '1024x1024', 
      quality = 'standard',
      style = 'natural',
      outputFormat = 'png',
      compression = 80,
      isVipModel = false
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: '请提供图片描述' }, { status: 400 });
    }

    // 从请求头获取认证信息
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 创建OpenAI客户端
    const client = new OpenAI({
      apiKey: process.env.OPENAI_IMAGE_API_KEY,
      baseURL: 'https://api.mnapi.com/v1',
    });

    // 构建请求参数
    const generateParams: any = {
      model: isVipModel ? 'gpt-image-1-vip' : 'gpt-image-1',
      prompt: prompt,
      n: 1,
      size: size as any,
      quality: quality as any,
      response_format: 'b64_json'
    };

    // VIP模型特有参数
    if (isVipModel) {
      generateParams.style = style;
      
      // 如果选择了特定的输出格式，添加相关参数
      if (outputFormat !== 'png') {
        generateParams.output_format = outputFormat;
        
        // 对于JPEG和WebP，添加压缩参数
        if (outputFormat === 'jpeg' || outputFormat === 'webp') {
          generateParams.output_compression = compression;
        }
      }
    }

    // 生成图片
    const response = await client.images.generate(generateParams);

    // 返回base64编码的图片
    return NextResponse.json({
      image: response.data[0].b64_json,
      revised_prompt: response.data[0].revised_prompt
    });

  } catch (error: any) {
    console.error('图片生成错误:', error);
    return NextResponse.json(
      { error: error.message || '图片生成失败' },
      { status: 500 }
    );
  }
} 