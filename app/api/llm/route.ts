import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LLMFactory } from '@/lib/llm/factory';
import { rateLimit } from '@/lib/rate-limit';
import { LLMResponse } from '@/lib/llm/base';

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

// 设置速率限制器 - 每分钟20次请求
const limiter = rateLimit({
  interval: 60 * 1000, // 1分钟
  uniqueTokenPerInterval: 500 // 最大用户数
});

// 添加令牌缓存层
const tokenCache = new Map<string, {userId: string, expiry: number}>();

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
      // 使用缓存的用户ID
      userId = cachedData.userId;
      console.log('使用缓存的令牌验证');
    } else {
      // 令牌未缓存或已过期，验证令牌
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
      }
      
      userId = user.id;
      
      // 缓存令牌，有效期30分钟
      tokenCache.set(token, {
        userId,
        expiry: now + 30 * 60 * 1000 // 30分钟
      });
      
      console.log('令牌已验证并缓存');
    }

    // 2. 速率限制检查
    try {
      await limiter.check(req, 20, userId);
    } catch (error) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }

    // 3. 解析请求数据
    const requestData = await req.json();
    const { 
      provider = 'openai', // 默认使用OpenAI 
      modelName, 
      messages, 
      prompt,
      temperature = 0.7,
      maxTokens,
      systemPrompt,
      tools,
      options = {},
      stream
    } = requestData;

    // 4. 验证必要参数
    if (!messages && !prompt) {
      return NextResponse.json({ error: '缺少必要的messages或prompt参数' }, { status: 400 });
    }

    // 5. 获取LLM实例
    const llm = LLMFactory.create(provider, { 
      modelName, 
      systemPrompt,
      temperature,
      maxTokens,
      options
    });

    // 6. 根据请求类型调用相应接口
    let result: LLMResponse;
    if (messages) {
      // 聊天模式
      if (stream) {
        try {
          console.log('正在初始化流式响应...', { modelName });
          
          const result = await llm.chat(messages, {
            temperature,
            max_tokens: maxTokens,
            model: modelName,
            stream: true
          });
          
          // 如果有流式响应
          if (result.stream) {
            // 将stream赋值给一个确定非空的局部变量
            const stream = result.stream;
            const encoder = new TextEncoder();
            const readableStream = new ReadableStream({
              async start(controller) {
                try {
                  console.log('开始处理流...');
                  for await (const chunk of stream) {
                    console.log('收到流数据块:', chunk);
                    
                    // 改进这里，增强容错性
                    let content = '';
                    
                    // 适配不同的API响应格式
                    if (chunk.choices && chunk.choices[0]?.delta?.content) {
                      // OpenAI格式
                      content = chunk.choices[0].delta.content;
                    } else if (chunk.choices && chunk.choices[0]?.text) {
                      // 有些API使用这种格式
                      content = chunk.choices[0].text;
                    } else if (chunk.delta?.content) {
                      // Anthropic格式
                      content = chunk.delta.content;
                    } else if (chunk.content) {
                      // 简化格式
                      content = chunk.content;
                    } else if (typeof chunk === 'string') {
                      // 有些API可能直接返回字符串
                      content = chunk;
                    }
                    
                    if (content) {
                      const data = encoder.encode(`data: ${JSON.stringify({ 
                        text: content,
                        done: false 
                      })}\n\n`);
                      controller.enqueue(data);
                    }
                  }
                  
                  // 发送完成信号
                  console.log('流处理完成，发送结束信号');
                  const finalData = encoder.encode(`data: ${JSON.stringify({ 
                    text: '', 
                    done: true 
                  })}\n\n`);
                  controller.enqueue(finalData);
                  controller.close();
                } catch (error) {
                  // 发送错误信号
                  console.error('流处理过程中出错:', error);
                  const errorData = encoder.encode(`data: ${JSON.stringify({ 
                    error: `流式响应出错: ${(error as Error).message}`, 
                    done: true 
                  })}\n\n`);
                  controller.enqueue(errorData);
                  controller.close();
                }
              }
            });
            
            return new Response(readableStream, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              },
            });
          } else {
            // 回退到非流式响应
            console.log('LLM未返回流对象，回退到非流式响应');
            const text = result.text || '';
            
            // 创建一个模拟的流响应
            const encoder = new TextEncoder();
            const stream = new TransformStream();
            const writer = stream.writable.getWriter();
            
            // 直接发送完整文本，然后关闭流
            const data = encoder.encode(`data: ${JSON.stringify({ text, done: false })}\n\n`);
            await writer.write(data);
            
            // 发送完成信号
            const finalData = encoder.encode(`data: ${JSON.stringify({ text: '', done: true })}\n\n`);
            await writer.write(finalData);
            await writer.close();
            
            return new Response(stream.readable, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              },
            });
          }
        } catch (error: any) {
          // 直接返回原始错误信息
          return NextResponse.json({ 
            error: error.error?.message || error.message || '请求失败'
          }, { status: error.status || 500 });
        }
      } else {
        result = await llm.chat(messages, tools);
      }
    } else {
      // 补全模式
      if (stream) {
        try {
          result = await llm.complete(prompt, {
            temperature,
            max_tokens: maxTokens,
            model: modelName,
            stream: true
          });
          
          // 如果LLM返回了流对象
          if (result.streaming && result.stream) {
            // 将stream赋值给一个确定非空的局部变量
            const stream = result.stream;
            const encoder = new TextEncoder();
            const readableStream = new ReadableStream({
              async start(controller) {
                try {
                  for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                      const data = encoder.encode(`data: ${JSON.stringify({ 
                        text: content,
                        done: false 
                      })}\n\n`);
                      controller.enqueue(data);
                    }
                  }
                  
                  // 发送完成信号
                  const finalData = encoder.encode(`data: ${JSON.stringify({ 
                    text: '', 
                    done: true 
                  })}\n\n`);
                  controller.enqueue(finalData);
                  controller.close();
                } catch (error) {
                  // 发送错误信号
                  const errorData = encoder.encode(`data: ${JSON.stringify({ 
                    error: `流式响应出错: ${(error as Error).message}`, 
                    done: true 
                  })}\n\n`);
                  controller.enqueue(errorData);
                  controller.close();
                  console.error('流式输出错误', error);
                }
              }
            });
            
            return new Response(readableStream, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              },
            });
          }
        } catch (error) {
          console.error('流式处理错误:', error);
          return NextResponse.json({ error: '流式处理失败' }, { status: 500 });
        }
      } else {
        result = await llm.complete(prompt);
      }
    }

    // 7. 记录使用统计(可选)
    try {
      await supabase
        .from('llm_usage')
        .insert({
          user_id: userId,
          provider,
          model: modelName || llm.getDefaultModel(),
          input_tokens: result.tokens?.prompt || 0,
          output_tokens: result.tokens?.completion || 0, 
          cost: result.cost || 0,
          created_at: new Date().toISOString()
        });
    } catch (error: any) {
      console.error('记录LLM使用统计失败:', error);
    }

    // 8. 返回结果
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('LLM API调用失败:', error);
    
    // 返回原始错误信息
    return NextResponse.json({ 
      error: error.error?.message || error.message || '请求失败'
    }, { status: error.status || 500 });
  }
} 