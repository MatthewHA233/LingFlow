import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import crypto from 'crypto'
import JSZip from 'jszip'
import { processChapterContent, normalizePath, getMimeType } from '@/lib/content-processor'
import { NextRequest } from 'next/server'
import fs from 'fs'
import { headers } from 'next/headers'

// 语境块类型定义
interface ContentBlock {
  type: 'text' | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'heading_5' | 'heading_6' | 'image';
  content: string;
  metadata?: Record<string, any>;
}

// 解析章节内容为语境块
function parseChapterContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = content.split('\n');
  let currentBlock: ContentBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 跳过空行
    if (!line) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // 处理标题
    if (line.startsWith('#')) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      
      const headingMatch = line.match(/^#+/);
      if (headingMatch) {
        const level = headingMatch[0].length;
        if (level <= 6) {
          blocks.push({
            type: `heading_${level}` as ContentBlock['type'],
            content: line.replace(/^#+\s*/, '').trim()
          });
        }
      }
      currentBlock = null;
      continue;
    }

    // 处理图片 - 修改图片处理逻辑
    const imageMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      
      const [_, alt, src] = imageMatch;
      blocks.push({
        type: 'image',
        content: src,
        metadata: {
          alt: alt || '',
          originalSrc: src
        }
      });
      continue;
    }

    // 处理普通文本
    if (!currentBlock) {
      currentBlock = {
        type: 'text',
        content: line
      };
    } else if (currentBlock.type === 'text') {
      currentBlock.content += '\n' + line;
    }
  }

  // 添加最后一个块
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

// 使用新的路由段配置
export const dynamic = 'force-dynamic'
export const revalidate = false
export const fetchCache = 'force-no-store'
export const maxDuration = 600
export const runtime = 'nodejs'

const RETRY_COUNT = 3;
const TIMEOUT = 120000; // 从30秒增加到120秒

// 添加连接池管理
const POOL_SIZE = 20;
const CONNECTION_TIMEOUT = 30000; // 从10秒增加到30秒

let supabasePool: any[] = [];
let currentPoolIndex = 0;

function getSupabaseClient() {
  if (supabasePool.length < POOL_SIZE) {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: { 'x-custom-timeout': TIMEOUT.toString() },
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      }
    );
    supabasePool.push(client);
    return client;
  }
  
  currentPoolIndex = (currentPoolIndex + 1) % POOL_SIZE;
  return supabasePool[currentPoolIndex];
}

// 修改健康检查函数
async function checkConnection() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('books').select('id').limit(1).timeout(5000);
    if (error) {
      console.error('数据库连接检查失败:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('连接检查异常:', error);
    return false;
  }
}

// 修改重试逻辑
async function withConnectionRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0) {
        console.log(`第 ${i + 1} 次重试...`);
        // 使用指数退避策略
        await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, i)));
      }
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.error(`操作失败 (尝试 ${i + 1}/${maxRetries}):`, error);
      
      // 增加连接错误的处理
      if (error.message?.includes('fetch failed') || 
          error.message?.includes('timeout') || 
          error.message?.includes('socket hang up')) {
        // 重置连接池
        supabasePool = [];
        currentPoolIndex = 0;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// 添加请求超时控制
async function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`请求超时 (${timeout}ms)`)), timeout);
  });
  return Promise.race([promise, timeoutPromise]);
}

interface Resource {
  href: string;
  'media-type'?: string;
  id?: string;
}

interface BookResource {
  book_id: string;
  original_path: string;
  oss_path: string;
  resource_type: string;
  mime_type: string;
}

interface ImageResource {
  href: string;
  'media-type'?: string;
  type?: string;
  id?: string;
}

interface UploadChapter {
  title: string;
  content: string;
}

// 添加新的接口来处理不同阶段
interface UploadStage {
  stage: number;
  bookId?: string;
  userId: string;
  file?: File;
  bookData?: any;
  arrayBuffer?: ArrayBuffer;
}

// 添加内存管理和流式处理
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const GC_INTERVAL = 50; // 每处理50个项目后触发GC

// 添加常量定义(文件顶部附近)
const BATCH_SIZE = 50; // 批处理大小

// 添加 processChapter 函数定义
async function processChapter(chapter: UploadChapter, index: number, userId: string, bookId: string) {
  const { data: contentParent } = await getSupabaseClient()
    .from('content_parents')
    .insert({
      content_type: 'chapter',
      title: chapter.title,
      user_id: userId,
      metadata: {
        book_id: bookId,
        chapter_index: index
      }
    })
    .select('id')
    .single();

  if (!contentParent) throw new Error('创建 content_parent 失败');

  const { data: savedChapter } = await getSupabaseClient()
    .from('chapters')
    .insert({
      book_id: bookId,
      title: chapter.title,
      order_index: index,
      parent_id: contentParent.id
    })
    .select()
    .single();

  if (!savedChapter) throw new Error('创建 chapter 失败');

  const blocks = parseChapterContent(chapter.content);
  const batchSize = 50;
  const blockPromises = [];
  
  for (let j = 0; j < blocks.length; j += batchSize) {
    const batch = blocks.slice(j, j + batchSize).map((block, idx) => ({
      parent_id: contentParent.id,
      block_type: block.type,
      content: block.content,
      order_index: j + idx,
      metadata: block.metadata || {}
    }));

    blockPromises.push(
      getSupabaseClient().from('context_blocks').insert(batch)
    );
  }

  await Promise.all(blockPromises);
  return savedChapter;
}

// 修改文件处理逻辑
async function processFileInChunks(file: File) {
  const chunks: Uint8Array[] = [];
  const fileStream = file.stream();
  const reader = fileStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(new Uint8Array(value));
      }
      
      if (chunks.length % GC_INTERVAL === 0) {
        global.gc && global.gc();
      }
    }
    // 修改这里的类型转换
    const concatenatedArray = new Uint8Array(
      chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    );
    let offset = 0;
    for (const chunk of chunks) {
      concatenatedArray.set(chunk, offset);
      offset += chunk.length;
    }
    return Buffer.from(concatenatedArray);
  } finally {
    reader.releaseLock();
  }
}

// 修改资源处理逻辑
async function processResources(
  zip: JSZip, 
  resources: ImageResource[], 
  baseDir: string, 
  client: any,
  bookId: string
) {
  const resourceUploads: BookResource[] = [];
  let processedCount = 0;

  for (const resource of resources) {
    try {
      const normalizedPath = normalizePath(resource.href);
      const imageFile = zip.file(normalizedPath) || 
                       zip.file(`OEBPS/${normalizedPath}`) || 
                       zip.file(`OPS/${normalizedPath}`);

      if (imageFile) {
        const imageStream = await imageFile.nodeStream();
        const chunks: Uint8Array[] = [];
        
        for await (const chunk of imageStream) {
          chunks.push(Buffer.isBuffer(chunk) ? new Uint8Array(chunk) : new TextEncoder().encode(chunk));
          if (chunks.length % GC_INTERVAL === 0) {
            global.gc && global.gc();
          }
        }

        // 修改这里的类型转换
        const concatenatedArray = new Uint8Array(
          chunks.reduce((acc, chunk) => acc + chunk.length, 0)
        );
        let offset = 0;
        for (const chunk of chunks) {
          concatenatedArray.set(chunk, offset);
          offset += chunk.length;
        }
        const imageBuffer = Buffer.from(concatenatedArray);
        const resourcePath = `${baseDir}/resources/${path.basename(normalizedPath)}`;
        
        await client.put(resourcePath, imageBuffer, {
          mime: resource['media-type'] || getMimeType(normalizedPath),
          headers: { 'Cache-Control': 'max-age=31536000' }
        });

        resourceUploads.push({
          book_id: bookId,
          original_path: normalizedPath,
          oss_path: `https://chango-url.oss-cn-beijing.aliyuncs.com/${resourcePath}`,
          resource_type: 'image',
          mime_type: resource['media-type'] || getMimeType(normalizedPath)
        });

        // 清理临时数据
        imageBuffer.fill(0);
        chunks.length = 0;
        
        processedCount++;
        if (processedCount % GC_INTERVAL === 0) {
          global.gc && global.gc();
        }
      }
    } catch (error) {
      console.error('处理资源失败:', error);
    }
  }

  return resourceUploads;
}

// 修改章节处理逻辑
async function processChaptersInBatches(chapters: UploadChapter[], userId: string, bookId: string) {
  const batchSize = 5; // 每批处理5个章节
  const results = [];

  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, Math.min(i + batchSize, chapters.length));
    const batchResults = await Promise.all(
      batch.map((chapter, index) => processChapter(chapter, i + index, userId, bookId))
    );
    results.push(...batchResults);

    // 主动清理内存
    if (i % GC_INTERVAL === 0) {
      global.gc && global.gc();
    }
  }

  return results;
}

// 流式处理中间件
const streamHandler = async (req: NextRequest) => {
  try {
    const body = req.body;
    if (!body) {
      return NextResponse.json({ error: '空请求体' }, { status: 400 });
    }

    const reader = body.getReader();
    const tempFilePath = `/tmp/upload-${Date.now()}.tmp`;
    const writeStream = fs.createWriteStream(tempFilePath);

    let isDone = false;
    while (!isDone) {
      const { done, value } = await reader.read();
      isDone = !!done;
      if (value) {
        await new Promise((resolve, reject) => {
          writeStream.write(value, (err) => {
            err ? reject(err) : resolve(true);
          });
        });
      }
    }

    writeStream.end();

    return NextResponse.json({ 
      success: true,
      tempFilePath
    });

  } catch (error: any) {
    console.error('流处理失败:', error);
    return NextResponse.json(
      { error: error.message || '流处理失败' },
      { status: 500 }
    );
  }
}

// 添加重试函数
async function retryOperation(operation: () => Promise<any>, retries = RETRY_COUNT, initialBackoff = 1000) {
  let backoff = initialBackoff;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      console.error(`操作失败 (尝试 ${i + 1}/${retries}):`, error.message);
      if (i === retries - 1) throw error;
      
      // 动态调整退避时间，但设置最大值
      backoff = Math.min(backoff * 1.5, 10000);
      await new Promise(resolve => setTimeout(resolve, backoff));
      
      // 检查是否需要手动触发GC
      if (global.gc && process.memoryUsage().heapUsed > 200 * 1024 * 1024) {
        global.gc();
      }
    }
  }
}

// 添加在文件开头
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

// 修改表单处理函数
async function handleFormUpload(req: NextRequest) {
  try {
    // 检查请求大小
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: '文件大小超过限制' },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const stage = Number(formData.get('stage'));
    const userId = formData.get('userId') as string;
    const bookId = formData.get('bookId') as string;
    
    try {
      // 第一阶段：验证用户和初始化 (0-30%)
      if (stage === 1) {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return NextResponse.json({ error: '未授权访问' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await getSupabaseClient().auth.getUser(token);
        
        if (userError || !user) {
          return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
        }

        const file = formData.get('file') as File;
        const bookDataStr = formData.get('bookData') as string;
        
        if (!file || !bookDataStr) {
          return NextResponse.json({ error: '缺少必要的上传数据' }, { status: 400 });
        }

        const bookData = JSON.parse(bookDataStr);
        const newBookId = crypto.randomUUID();

        return NextResponse.json({
          progress: 30,
          bookId: newBookId,
          userId: user.id
        });
      }

      // 第二阶段：上传EPUB文件和基本信息 (30-50%)
      if (stage === 2) {
        const file = formData.get('file') as File;
        const bookData = JSON.parse(formData.get('bookData') as string);
        
        // 提前获取arrayBuffer，避免在OSS操作中重复获取
        const arrayBuffer = await file.arrayBuffer();
        const epubBuffer = Buffer.from(arrayBuffer);
        
        const { default: OSS } = await import('ali-oss');
        const client = new OSS({
          region: 'oss-cn-beijing',
          accessKeyId: process.env.ALIYUN_AK_ID || '',
          accessKeySecret: process.env.ALIYUN_AK_SECRET || '',
          bucket: 'chango-url',
          secure: true,
          timeout: 120000, // 添加OSS客户端超时设置
          // 使用类型断言解决属性不存在的问题
          ...({
            retryMax: 5,
            retryTimeout: 60000
          } as any)
        });

        try {
          const baseDir = `books/${userId}/${bookId}`;
          const epubPath = `${baseDir}/${path.basename(file.name)}`;
          
          // 使用更可靠的方式上传，增加重试
          const epubResult = await retryOperation(async () => {
            return await client.put(epubPath, epubBuffer, {
              mime: 'application/epub+zip',
              headers: { 'Cache-Control': 'max-age=31536000' },
              timeout: 120000 // 单独为这个操作设置超时
            });
          }, 3);
          
          const { data: savedBook, error: bookError } = await withTimeout(
            withConnectionRetry(async () => {
              const client = getSupabaseClient();
              return await client
                .from('books')
                .insert([{
                  id: bookId,
                  title: bookData.title,
                  author: bookData.author,
                  epub_path: epubResult.url.replace('http://', 'https://'),
                  user_id: userId,
                  metadata: bookData.metadata || {},
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  cover_url: bookData.coverUrl || '',
                  audio_path: '',
                  description: bookData.metadata?.description || ''
                }])
                .select()
                .single();
            }),
            30000 // 30秒超时
          );

          if (bookError) throw bookError;

          return NextResponse.json({
            progress: 50,
            book: savedBook
          });
        } catch (error: any) {
          console.error('OSS上传失败:', error);
          return NextResponse.json({
            error: '文件上传失败',
            details: error.message,
            stage: 'OSS上传'
          }, { status: 500 });
        }
      }

      // 第三阶段：处理资源文件 (50-70%)
      if (stage === 3) {
        const file = formData.get('file') as File;
        const bookData = JSON.parse(formData.get('bookData') as string);
        const arrayBuffer = await file.arrayBuffer();
        
        const { default: OSS } = await import('ali-oss');
        const client = new OSS({
          region: 'oss-cn-beijing',
          accessKeyId: process.env.ALIYUN_AK_ID || '',
          accessKeySecret: process.env.ALIYUN_AK_SECRET || '',
          bucket: 'chango-url',
          secure: true
        });

        const baseDir = `books/${userId}/${bookId}`;
        const resourceUploads: BookResource[] = [];
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        for (const resource of bookData.resources.imageFiles) {
          try {
            const normalizedPath = normalizePath(resource.href);
            const imageFile = zip.file(normalizedPath) || 
                             zip.file(`OEBPS/${normalizedPath}`) || 
                             zip.file(`OPS/${normalizedPath}`);

            if (imageFile) {
              const imageBuffer = Buffer.from(await imageFile.async('arraybuffer'));
              const resourcePath = `${baseDir}/resources/${path.basename(normalizedPath)}`;
              
              await client.put(resourcePath, imageBuffer, {
                mime: resource['media-type'] || getMimeType(normalizedPath),
                headers: { 'Cache-Control': 'max-age=31536000' }
              });

              resourceUploads.push({
                book_id: bookId,
                original_path: normalizedPath,
                oss_path: `https://chango-url.oss-cn-beijing.aliyuncs.com/${resourcePath}`,
                resource_type: 'image',
                mime_type: resource['media-type'] || getMimeType(normalizedPath)
              });
            }
          } catch (error) {
            console.error('处理资源失败:', error);
          }
        }

        if (resourceUploads.length > 0) {
          await getSupabaseClient().from('book_resources').insert(resourceUploads);
        }

        return NextResponse.json({
          progress: 70,
          resources: resourceUploads
        });
      }

      // 第四阶段：处理章节内容 (70-100%)
      if (stage === 4) {
        const bookData = JSON.parse(formData.get('bookData') as string);
        
        // 分批处理章节，避免一次性创建过多Promise
        const totalChapters = bookData.chapters.length;
        const batchSize = 3; // 每批处理3个章节
        const savedChapters = [];
        
        for (let i = 0; i < totalChapters; i += batchSize) {
          const batch = bookData.chapters.slice(i, Math.min(i + batchSize, totalChapters));
          
          // 限制并发处理
          const batchResults = await Promise.all(
            batch.map((chapter: any, index: number) => 
              processChapterWithRetry(chapter, i + index, userId, bookId)
            )
          );
          
          savedChapters.push(...batchResults);
          
          // 强制垃圾回收并暂停一下，给服务器"喘息"的机会
          if (global.gc && i % 9 === 0) {
            global.gc();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        return NextResponse.json({
          progress: 100,
          chapters: savedChapters
        });
      }

      return NextResponse.json({ error: '无效的处理阶段' }, { status: 400 });
    } catch (error: any) {
      console.error('上传处理失败:', {
        message: error.message,
        stack: error.stack,
        details: error.details,
        currentStage: stage,
        connectionStatus: await checkConnection()
      });
      
      // 如果是连接相关错误，尝试重置连接池
      if (error.message?.includes('fetch failed')) {
        supabasePool = [];
        currentPoolIndex = 0;
      }

      return NextResponse.json(
        { 
          error: error.message || '上传失败', 
          details: error.details,
          connectionError: error.message?.includes('fetch failed')
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('上传处理失败:', {
      error,
      headers: Object.fromEntries(req.headers.entries()),
      method: req.method
    });
    return NextResponse.json(
      { error: error.message || '上传失败' },
      { status: 500 }
    );
  }
}

// 修改POST处理函数
export async function POST(req: NextRequest) {
  try {
    // 添加响应头
    const responseHeaders = new Headers({
      'Access-Control-Allow-Origin': 'https://lf.cc-ty.net.cn',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });

    // 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { headers: responseHeaders });
    }

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const response = await handleFormUpload(req);
      // 将 CORS 头添加到响应中
      Object.entries(responseHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }
    return await streamHandler(req);
  } catch (error: any) {
    console.error('上传处理失败:', {
      error,
      headers: Object.fromEntries(req.headers.entries()),
      method: req.method
    });
    return NextResponse.json(
      { error: error.message || '上传失败' },
      { status: 500 }
    );
  }
}

// 优化章节处理函数
async function processChapterWithRetry(
  chapter: any, 
  index: number, 
  userId: string, 
  bookId: string
) {
  return await retryOperation(async () => {
    // 减少一次数据库操作，合并两次插入为一次事务
    const { data: contentParent } = await getSupabaseClient()
      .from('content_parents')
      .insert({
        content_type: 'chapter',
        title: chapter.title,
        user_id: userId,
        metadata: { book_id: bookId, chapter_index: index }
      })
      .select('id')
      .single();
      
    if (!contentParent) throw new Error('创建 content_parent 失败');
    
    const { data: savedChapter } = await getSupabaseClient()
      .from('chapters')
      .insert({
        book_id: bookId,
        title: chapter.title,
        order_index: index,
        parent_id: contentParent.id
      })
      .select()
      .single();
      
    if (!savedChapter) throw new Error('创建 chapter 失败');
    
    // 批量处理语境块，减少数据库连接数
    const blocks = parseChapterContent(chapter.content);
    for (let j = 0; j < blocks.length; j += BATCH_SIZE) {
      const batch = blocks.slice(j, j + BATCH_SIZE).map((block, idx) => ({
        parent_id: contentParent.id,
        block_type: block.type,
        content: block.content,
        order_index: j + idx,
        metadata: block.metadata || {}
      }));
      
      await getSupabaseClient().from('context_blocks').insert(batch);
      
      // 短暂暂停，避免过度消耗资源
      if (j > 0 && j % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return savedChapter;
  }, 3);
} 