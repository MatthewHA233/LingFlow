import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import crypto from 'crypto'
import JSZip from 'jszip'
import { processChapterContent, normalizePath, getMimeType } from '@/lib/content-processor'
import { NextRequest } from 'next/server'
import fs from 'fs'

// 日志记录功能
const colors = {
  INFO: '\x1b[32m', // 绿色
  DEBUG: '\x1b[36m', // 青色
  WARN: '\x1b[33m',  // 黄色
  ERROR: '\x1b[31m', // 红色
  reset: '\x1b[0m'   // 重置
};

// 生成唯一请求 ID
function generateRequestId() {
  return crypto.randomBytes(4).toString('hex');
}

// 日志记录函数
function log(level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR', requestId: string, message: string, error?: any) {
  const timestamp = new Date().toISOString();
  const colorCode = colors[level];
  const logMessage = `[${timestamp}] ${level}: [${requestId}] ${message}`;
  
  if (error) {
    console.log(`${colorCode}${logMessage}${colors.reset}`);
    console.log(`${colors.ERROR}ERROR_DETAILS: ${error.message || error}${colors.reset}`);
  } else {
    console.log(`${colorCode}${logMessage}${colors.reset}`);
  }
}

// 性能计时工具
class Timer {
  private startTime: number;
  private markers: Map<string, number> = new Map();
  
  constructor() {
    this.startTime = performance.now();
  }
  
  mark(name: string) {
    this.markers.set(name, performance.now());
  }
  
  getElapsed(markerName?: string): number {
    const endTime = markerName ? this.markers.get(markerName) : performance.now();
    if (markerName && !endTime) {
      return 0;
    }
    return Math.round(endTime! - this.startTime);
  }
}

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
export const maxDuration = 300
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

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

// 流式处理中间件
const streamHandler = async (req: NextRequest, requestId: string, timer: Timer) => {
  try {
    log('INFO', requestId, '⏱️ 开始流式处理请求');
    timer.mark('streamStart');
    
    const body = req.body;
    if (!body) {
      log('ERROR', requestId, '❌ 请求体为空');
      return NextResponse.json({ error: '空请求体' }, { status: 400 });
    }

    const reader = body.getReader();
    const tempFilePath = `/tmp/upload-${Date.now()}.tmp`;
    log('DEBUG', requestId, `📂 创建临时文件: ${tempFilePath}`);
    const writeStream = fs.createWriteStream(tempFilePath);

    let isDone = false;
    let bytesRead = 0;
    while (!isDone) {
      const { done, value } = await reader.read();
      isDone = !!done;
      if (value) {
        bytesRead += value.length;
        await new Promise((resolve, reject) => {
          writeStream.write(value, (err) => {
            err ? reject(err) : resolve(true);
          });
        });
      }
    }

    writeStream.end();
    timer.mark('streamEnd');
    log('INFO', requestId, `✅ 流处理完成，总共读取 ${bytesRead} 字节，耗时: ${timer.getElapsed('streamEnd') - timer.getElapsed('streamStart')}ms`);

    return NextResponse.json({ 
      success: true,
      tempFilePath
    });

  } catch (error: any) {
    timer.mark('streamError');
    log('ERROR', requestId, `❌ 流处理失败，耗时: ${timer.getElapsed('streamError') - timer.getElapsed('streamStart')}ms`, error);
    return NextResponse.json(
      { error: error.message || '流处理失败' },
      { status: 500 }
    );
  }
}

// 修改POST处理函数
export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const timer = new Timer();
  log('INFO', requestId, '📤 开始处理上传请求');
  
  try {
    const contentType = req.headers.get('content-type') || '';
    log('DEBUG', requestId, `🔍 请求内容类型: ${contentType}`);
    
    if (contentType.includes('multipart/form-data')) {
      log('INFO', requestId, '🔄 使用表单数据处理方式');
      return await handleFormUpload(req, requestId, timer);
    }
    
    log('INFO', requestId, '🔄 使用流处理方式');
    return await streamHandler(req, requestId, timer);
  } catch (error: any) {
    const totalTime = timer.getElapsed();
    log('ERROR', requestId, `❌ 上传处理失败，总耗时: ${totalTime}ms`, error);
    log('INFO', requestId, `⏱️ 整体请求 完成, 耗时: ${totalTime}ms`);
    log('DEBUG', requestId, `📊 内存使用 (错误结束)`);
    
    return NextResponse.json(
      { error: error.message || '上传失败' },
      { status: 500 }
    );
  }
}

// 原有的表单处理函数
async function handleFormUpload(req: NextRequest, requestId: string, timer: Timer) {
  try {
    log('DEBUG', requestId, '⏱️ 开始解析表单数据');
    timer.mark('formStart');
    
    const formData = await req.formData();
    const stage = Number(formData.get('stage'));
    const userId = formData.get('userId') as string;
    const bookId = formData.get('bookId') as string;
    
    log('INFO', requestId, `📋 表单数据解析完成，处理阶段: ${stage}, 用户ID: ${userId}, 书籍ID: ${bookId}`);
    log('DEBUG', requestId, `⏱️ 表单解析耗时: ${timer.getElapsed() - timer.getElapsed('formStart')}ms`);
    
    // 第一阶段：验证用户和初始化 (0-30%)
    if (stage === 1) {
      log('INFO', requestId, '🔑 阶段1: 开始验证用户身份');
      timer.mark('stage1Start');
      
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        log('ERROR', requestId, '❌ 未提供授权头');
        return NextResponse.json({ error: '未授权访问' }, { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      log('DEBUG', requestId, '🔍 开始验证token');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        log('ERROR', requestId, '❌ 用户验证失败', userError);
        return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
      }
      
      log('INFO', requestId, `✅ 用户验证成功，用户ID: ${user.id}`);

      const file = formData.get('file') as File;
      const bookDataStr = formData.get('bookData') as string;
      
      if (!file || !bookDataStr) {
        log('ERROR', requestId, '❌ 表单数据不完整');
        return NextResponse.json({ error: '缺少必要的上传数据' }, { status: 400 });
      }

      const bookData = JSON.parse(bookDataStr);
      const newBookId = crypto.randomUUID();
      
      log('INFO', requestId, `✅ 阶段1完成，创建新书籍ID: ${newBookId}`);
      log('DEBUG', requestId, `⏱️ 阶段1耗时: ${timer.getElapsed() - timer.getElapsed('stage1Start')}ms`);

      return NextResponse.json({
        progress: 30,
        bookId: newBookId,
        userId: user.id
      });
    }

    // 第二阶段：上传EPUB文件和基本信息 (30-50%)
    if (stage === 2) {
      log('INFO', requestId, '📚 阶段2: 开始上传EPUB文件');
      timer.mark('stage2Start');
      
      const file = formData.get('file') as File;
      const bookData = JSON.parse(formData.get('bookData') as string);
      
      log('DEBUG', requestId, `📦 文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB, 书名: ${bookData.title}`);
      
      const { default: OSS } = await import('ali-oss');
      log('DEBUG', requestId, '🔄 初始化OSS客户端');
      
      const client = new OSS({
        region: 'oss-cn-beijing',
        accessKeyId: process.env.ALIYUN_AK_ID || '',
        accessKeySecret: process.env.ALIYUN_AK_SECRET || '',
        bucket: 'chango-url',
        secure: true
      });

      const baseDir = `books/${userId}/${bookId}`;
      const epubPath = `${baseDir}/${path.basename(file.name)}`;
      log('DEBUG', requestId, `⏱️ 开始转换文件为ArrayBuffer`);
      
      const arrayBuffer = await file.arrayBuffer();
      const epubBuffer = Buffer.from(arrayBuffer);
      
      log('DEBUG', requestId, `⏱️ 开始上传EPUB到OSS: ${epubPath}`);
      timer.mark('epubUploadStart');
      
      const epubResult = await client.put(epubPath, epubBuffer, {
        mime: 'application/epub+zip',
        headers: { 'Cache-Control': 'max-age=31536000' }
      });
      
      timer.mark('epubUploadEnd');
      log('INFO', requestId, `✅ EPUB上传成功: ${epubResult.url}，耗时: ${timer.getElapsed('epubUploadEnd') - timer.getElapsed('epubUploadStart')}ms`);

      log('DEBUG', requestId, `⏱️ 开始计时: 创建书籍记录`);
      timer.mark('bookCreateStart');
      
      const { data: savedBook, error: bookError } = await supabase
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

      timer.mark('bookCreateEnd');
      
      if (bookError) {
        log('ERROR', requestId, `❌ 创建书籍记录失败`, bookError);
        throw bookError;
      }
      
      log('INFO', requestId, `✅ 书籍记录创建成功: ${savedBook.id}, 耗时: ${timer.getElapsed('bookCreateEnd') - timer.getElapsed('bookCreateStart')}ms`);
      log('INFO', requestId, `✅ 阶段2完成，总耗时: ${timer.getElapsed() - timer.getElapsed('stage2Start')}ms`);

      return NextResponse.json({
        progress: 50,
        book: savedBook
      });
    }

    // 第三阶段：处理资源文件 (50-70%)
    if (stage === 3) {
      log('INFO', requestId, '🖼️ 阶段3: 开始处理资源文件');
      timer.mark('stage3Start');
      
      const file = formData.get('file') as File;
      const bookData = JSON.parse(formData.get('bookData') as string);
      
      log('DEBUG', requestId, `📦 处理资源文件，图像数量: ${bookData.resources.imageFiles.length}`);
      log('DEBUG', requestId, `⏱️ 开始转换文件为ArrayBuffer`);
      
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
      
      log('DEBUG', requestId, `⏱️ 开始解压EPUB文件`);
      timer.mark('zipLoadStart');
      
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      timer.mark('zipLoadEnd');
      log('INFO', requestId, `✅ EPUB解压完成，耗时: ${timer.getElapsed('zipLoadEnd') - timer.getElapsed('zipLoadStart')}ms`);
      
      log('INFO', requestId, `⏱️ 开始处理 ${bookData.resources.imageFiles.length} 个资源文件`);
      timer.mark('resourceProcessStart');
      
      let successCount = 0;
      let failCount = 0;
      
      for (const resource of bookData.resources.imageFiles) {
        try {
          const normalizedPath = normalizePath(resource.href);
          log('DEBUG', requestId, `🔍 处理资源: ${normalizedPath}`);
          
          const imageFile = zip.file(normalizedPath) || 
                           zip.file(`OEBPS/${normalizedPath}`) || 
                           zip.file(`OPS/${normalizedPath}`);

          if (imageFile) {
            const imageBuffer = Buffer.from(await imageFile.async('arraybuffer'));
            const resourcePath = `${baseDir}/resources/${path.basename(normalizedPath)}`;
            
            log('DEBUG', requestId, `⏱️ 上传资源: ${resourcePath}`);
            timer.mark(`resourceUpload-${normalizedPath}`);
            
            await client.put(resourcePath, imageBuffer, {
              mime: resource['media-type'] || getMimeType(normalizedPath),
              headers: { 'Cache-Control': 'max-age=31536000' }
            });
            
            timer.mark(`resourceUploadEnd-${normalizedPath}`);
            log('DEBUG', requestId, `✅ 资源上传成功: ${resourcePath}, 耗时: ${timer.getElapsed(`resourceUploadEnd-${normalizedPath}`) - timer.getElapsed(`resourceUpload-${normalizedPath}`)}ms`);

            resourceUploads.push({
              book_id: bookId,
              original_path: normalizedPath,
              oss_path: `https://chango-url.oss-cn-beijing.aliyuncs.com/${resourcePath}`,
              resource_type: 'image',
              mime_type: resource['media-type'] || getMimeType(normalizedPath)
            });
            
            successCount++;
          } else {
            log('WARN', requestId, `⚠️ 找不到资源文件: ${normalizedPath}`);
            failCount++;
          }
        } catch (error) {
          failCount++;
          log('ERROR', requestId, `❌ 处理资源失败: ${resource.href}`, error);
        }
      }
      
      timer.mark('resourceProcessEnd');
      log('INFO', requestId, `✅ 资源处理完成，成功: ${successCount}, 失败: ${failCount}, 耗时: ${timer.getElapsed('resourceProcessEnd') - timer.getElapsed('resourceProcessStart')}ms`);

      if (resourceUploads.length > 0) {
        log('DEBUG', requestId, `⏱️ 开始保存资源记录到数据库，数量: ${resourceUploads.length}`);
        timer.mark('resourceSaveStart');
        
        const { error: resourceError } = await supabase.from('book_resources').insert(resourceUploads);
        
        timer.mark('resourceSaveEnd');
        if (resourceError) {
          log('ERROR', requestId, `❌ 保存资源记录失败`, resourceError);
        } else {
          log('INFO', requestId, `✅ 资源记录保存成功，耗时: ${timer.getElapsed('resourceSaveEnd') - timer.getElapsed('resourceSaveStart')}ms`);
        }
      }
      
      log('INFO', requestId, `✅ 阶段3完成，总耗时: ${timer.getElapsed() - timer.getElapsed('stage3Start')}ms`);

      return NextResponse.json({
        progress: 70,
        resources: resourceUploads
      });
    }

    // 第四阶段：处理章节内容 (70-100%)
    if (stage === 4) {
      log('INFO', requestId, '📝 阶段4: 开始处理章节内容');
      timer.mark('stage4Start');
      
      const bookData = JSON.parse(formData.get('bookData') as string);
      
      log('DEBUG', requestId, `📚 处理 ${bookData.chapters.length} 个章节`);
      
      const chapterPromises = bookData.chapters.map(async (chapter: UploadChapter, i: number) => {
        try {
          log('DEBUG', requestId, `⏱️ 开始处理第 ${i + 1} 章: ${chapter.title}`);
          timer.mark(`chapter-${i}-start`);
          
          const { data: contentParent, error: parentError } = await supabase
            .from('content_parents')
            .insert({
              content_type: 'chapter',
              title: chapter.title,
              user_id: userId,
              metadata: {
                book_id: bookId,
                chapter_index: i
              }
            })
            .select('id')
            .single();

          if (parentError || !contentParent) {
            log('ERROR', requestId, `❌ 创建 content_parent 失败，章节: ${i + 1}`, parentError);
            throw new Error('创建 content_parent 失败');
          }
          
          log('DEBUG', requestId, `✓ 创建章节父记录成功: ${contentParent.id}`);

          const { data: savedChapter, error: chapterError } = await supabase
            .from('chapters')
            .insert({
              book_id: bookId,
              title: chapter.title,
              order_index: i,
              parent_id: contentParent.id
            })
            .select()
            .single();

          if (chapterError || !savedChapter) {
            log('ERROR', requestId, `❌ 创建 chapter 失败，章节: ${i + 1}`, chapterError);
            throw new Error('创建 chapter 失败');
          }
          
          log('DEBUG', requestId, `✓ 创建章节记录成功: ${savedChapter.id}`);
          log('DEBUG', requestId, `⏱️ 开始解析章节内容块，章节: ${i + 1}`);
          timer.mark(`chapter-${i}-parse`);

          const blocks = parseChapterContent(chapter.content);
          
          timer.mark(`chapter-${i}-parsed`);
          log('DEBUG', requestId, `✓ 章节内容解析完成，共 ${blocks.length} 个块，耗时: ${timer.getElapsed(`chapter-${i}-parsed`) - timer.getElapsed(`chapter-${i}-parse`)}ms`);
          
          const batchSize = 50;
          const blockPromises = [];
          
          log('DEBUG', requestId, `⏱️ 开始保存章节内容块，分 ${Math.ceil(blocks.length / batchSize)} 批`);
          timer.mark(`chapter-${i}-save-blocks`);
          
          for (let j = 0; j < blocks.length; j += batchSize) {
            const batch = blocks.slice(j, j + batchSize).map((block, index) => ({
              parent_id: contentParent.id,
              block_type: block.type,
              content: block.content,
              order_index: j + index,
              metadata: block.metadata || {}
            }));

            blockPromises.push(
              supabase.from('context_blocks').insert(batch)
            );
          }

          await Promise.all(blockPromises);
          
          timer.mark(`chapter-${i}-end`);
          log('INFO', requestId, `✅ 章节 ${i + 1} 处理完成，耗时: ${timer.getElapsed(`chapter-${i}-end`) - timer.getElapsed(`chapter-${i}-start`)}ms`);
          
          return savedChapter;
        } catch (error) {
          log('ERROR', requestId, `❌ 处理第 ${i + 1} 章时出错:`, error);
          throw error;
        }
      });

      log('DEBUG', requestId, `⏱️ 等待所有章节处理完成`);
      timer.mark('allChaptersStart');
      
      const savedChapters = await Promise.all(chapterPromises);
      
      timer.mark('allChaptersEnd');
      log('INFO', requestId, `✅ 所有章节处理完成，总章节数: ${savedChapters.length}，耗时: ${timer.getElapsed('allChaptersEnd') - timer.getElapsed('allChaptersStart')}ms`);
      log('INFO', requestId, `✅ 阶段4完成，总耗时: ${timer.getElapsed() - timer.getElapsed('stage4Start')}ms`);

      const totalTime = timer.getElapsed();
      log('INFO', requestId, `✅ 书籍上传流程全部完成，总耗时: ${totalTime}ms`);
      log('INFO', requestId, `⏱️ 整体请求完成, 耗时: ${totalTime}ms`);
      log('DEBUG', requestId, `📊 内存使用 (正常结束): ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);

      return NextResponse.json({
        progress: 100,
        chapters: savedChapters
      });
    }

    log('ERROR', requestId, `❌ 无效的处理阶段: ${stage}`);
    return NextResponse.json({ error: '无效的处理阶段' }, { status: 400 });
  } catch (error: any) {
    const totalTime = timer.getElapsed();
    log('ERROR', requestId, `❌ 上传处理失败，总耗时: ${totalTime}ms`, error);
    log('INFO', requestId, `⏱️ 整体请求 完成, 耗时: ${totalTime}ms`);
    log('DEBUG', requestId, `📊 内存使用 (错误结束): ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
    
    return NextResponse.json(
      { error: error.message || '上传失败' },
      { status: 500 }
    );
  }
} 