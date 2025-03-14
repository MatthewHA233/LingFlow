import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import crypto from 'crypto'
import JSZip from 'jszip'
import { processChapterContent, normalizePath, getMimeType } from '@/lib/content-processor'
import { NextRequest } from 'next/server'
import fs from 'fs'
import os from 'os'
import { join } from 'path'
import { getPool } from '@/lib/supabase-pool'
import { batchProcessChapters } from '@/lib/supabase-pool'
import { uploadToOSS } from '@/lib/oss-client'
import OSS from 'ali-oss'

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
    const tempDir = os.tmpdir();
    const tempFilePath = join(tempDir, `upload-${Date.now()}.tmp`);
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

// 修改表单处理函数，确保类型正确
async function handleFormUpload(req: NextRequest, requestId: string, timer: Timer) {
  // 声明一个变量用于临时文件路径
  let tempFilePath: string | undefined;
  
  try {
    log('DEBUG', requestId, '⏱️ 开始解析表单数据');
    timer.mark('formStart');
    
    const formDataResponse = await streamFormData(req, requestId, timer);
    
    if (formDataResponse.error) {
      return NextResponse.json({ error: formDataResponse.error }, { status: 400 });
    }
    
    const { fields, filePath, file } = formDataResponse as FormDataResponse;
    tempFilePath = filePath; // 保存到外部作用域变量
    const stage = Number(fields.stage || '0');
    const userId = fields.userId as string;
    const bookId = fields.bookId as string;
    
    const bookData = fields.bookData ? JSON.parse(fields.bookData) : null;
    
    log('INFO', requestId, `📋 表单数据解析完成，处理阶段: ${stage}, 用户ID: ${userId}, 书籍ID: ${bookId}`);
    log('DEBUG', requestId, `⏱️ 表单解析耗时: ${timer.getElapsed() - timer.getElapsed('formStart')}ms`);
    
    const sql = getPool(requestId);  // 获取连接池实例
    
    // 使用事务包装所有数据库操作
    return await sql.begin(async (transaction) => {
    if (stage === 1) {
      log('INFO', requestId, '🔑 阶段1: 开始验证用户身份');
      timer.mark('stage1Start');
      
      // 记录所有请求头，以便调试
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headers[key] = value;
      });
      log('DEBUG', requestId, `📋 请求头摘要: ${Object.keys(headers).join(', ')}`);
      
      const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        log('ERROR', requestId, '❌ 未提供授权头');
        return NextResponse.json({ error: '未授权访问：缺少Authorization头部' }, { status: 401 });
      }

      log('DEBUG', requestId, `🔑 Authorization头类型: ${authHeader.substring(0, 10)}...`);
      const token = authHeader.split(' ')[1];
      if (!token) {
        log('ERROR', requestId, '❌ 无效的Authorization格式，缺少token部分');
        return NextResponse.json({ error: '未授权访问：无效的Authorization格式' }, { status: 401 });
      }
      
      log('DEBUG', requestId, '🔍 开始验证token');
      
      try {
        const authResponse = await supabase.auth.getUser(token);
        const { data, error: userError } = authResponse;
        
        log('DEBUG', requestId, `🔍 认证响应状态: ${userError ? '失败' : '成功'}`);
        
        if (userError) {
          log('ERROR', requestId, '❌ 用户验证失败', userError);
          return NextResponse.json({ 
            error: `用户验证失败: ${userError.message}`, 
            details: userError 
          }, { status: 401 });
        }
        
        if (!data.user) {
          log('ERROR', requestId, '❌ 用户验证成功但未返回用户数据');
          return NextResponse.json({ error: '用户验证失败: 未找到用户数据' }, { status: 401 });
        }
        
        log('INFO', requestId, `✅ 用户验证成功，用户ID: ${data.user.id}`);

      const newBookId = crypto.randomUUID();
        
        log('INFO', requestId, `✅ 阶段1完成，创建新书籍ID: ${newBookId}`);
        log('DEBUG', requestId, `⏱️ 阶段1耗时: ${timer.getElapsed() - timer.getElapsed('stage1Start')}ms`);

      return NextResponse.json({
        progress: 30,
        bookId: newBookId,
          userId: data.user.id
        });
      } catch (error: any) {
        log('ERROR', requestId, '❌ 验证过程中发生异常', error);
        return NextResponse.json({ 
          error: `验证过程中发生异常: ${error.message}`, 
          stack: error.stack 
        }, { status: 500 });
      }
    }

    if (stage === 2) {
      log('INFO', requestId, '📚 阶段2: 开始上传EPUB文件');
      timer.mark('stage2Start');
      
      if (!bookData) {
        log('WARN', requestId, '⚠️ 使用紧急处理方案创建bookData');
        // 添加：检查file是否存在
        if (!file) {
          log('ERROR', requestId, '❌ 缺少文件');
          return NextResponse.json({ error: '缺少文件' }, { status: 400 });
        }
        
        const bookDataJson = `{
          "title": "${file.name.replace(/\.epub$/, '').replace(/"/g, '\\"')}",
          "author": "未知作者",
          "metadata": {},
          "resources": { "imageFiles": [] }
        }`;
        try {
          const parsedData = JSON.parse(bookDataJson);
          return NextResponse.json({
            progress: 50,
            book: {
              id: bookId,
              title: parsedData.title,
              author: parsedData.author,
              epub_path: `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/books/${userId}/${bookId}/${file.name}`,
              user_id: userId,
              metadata: parsedData.metadata,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          });
        } catch (error) {
          log('ERROR', requestId, '❌ 紧急修复失败', error);
          return NextResponse.json({ error: '书籍数据处理失败' }, { status: 500 });
        }
      }
      
      // 添加：检查file是否存在
      if (!file) {
        log('ERROR', requestId, '❌ 缺少文件');
        return NextResponse.json({ error: '缺少文件' }, { status: 400 });
      }
      
      log('DEBUG', requestId, `📦 文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB, 书名: ${bookData.title}`);
      
        // 1. 先创建书籍记录
        log('DEBUG', requestId, '📝 创建书籍记录');
        timer.mark('bookCreateStart');
        
        await transaction.unsafe(
          `INSERT INTO books (
            id, user_id, title, author, epub_path, metadata, 
            created_at, updated_at, cover_url, description
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $7, $8, $9
          )`,
          [
            bookId,
            userId,
            bookData.title,
            bookData.author || '未知作者',
            `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/books/${userId}/${bookId}/${file.name}`,
            bookData.metadata || {},
            new Date().toISOString(),
            bookData.coverUrl || '',
            bookData.metadata?.description || ''
          ]
        );

        timer.mark('bookCreateEnd');
        log('INFO', requestId, `✅ 书籍记录创建成功: ${bookId}, 耗时: ${timer.getElapsed('bookCreateEnd') - timer.getElapsed('bookCreateStart')}ms`);

        // 2. 然后上传EPUB文件
      const baseDir = `books/${userId}/${bookId}`;
      const epubPath = `${baseDir}/${path.basename(file.name)}`;
      log('DEBUG', requestId, `⏱️ 开始上传EPUB到OSS: ${epubPath}`);
      timer.mark('epubUploadStart');
      
        const epubBuffer = Buffer.from(await file.arrayBuffer());
        const epubResult = await uploadToOSS(epubBuffer, epubPath);
      
      timer.mark('epubUploadEnd');
      log('INFO', requestId, `✅ EPUB上传成功: ${epubResult.url}，耗时: ${timer.getElapsed('epubUploadEnd') - timer.getElapsed('epubUploadStart')}ms`);

        return NextResponse.json({
          progress: 50,
          book: {
          id: bookId,
          title: bookData.title,
            author: bookData.author || '未知作者',
            epub_path: `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/books/${userId}/${bookId}/${file.name}`,
          user_id: userId,
          metadata: bookData.metadata || {},
          created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        });
      }

    if (stage === 3) {
      log('INFO', requestId, '🖼️ 阶段3: 开始处理资源文件');
      timer.mark('stage3Start');
      
      if (!bookData) {
        log('ERROR', requestId, '❌ 缺少书籍数据');
        return NextResponse.json({ error: '缺少书籍数据' }, { status: 400 });
      }
      
      if (!bookData.resources || !bookData.resources.imageFiles) {
        log('WARN', requestId, '⚠️ 书籍中没有图像资源');
        return NextResponse.json({
          progress: 70,
          resources: []
        });
      }
      
      log('DEBUG', requestId, `📦 处理资源文件，图像数量: ${bookData.resources.imageFiles.length}`);
      log('DEBUG', requestId, `⏱️ 开始转换文件为ArrayBuffer`);
      
      // 添加：检查file是否存在
      if (!file) {
        log('ERROR', requestId, '❌ 缺少文件');
        return NextResponse.json({ error: '缺少文件' }, { status: 400 });
      }
      
      const arrayBuffer = await file.arrayBuffer();
      
      const client = new OSS({
        region: process.env.OSS_REGION!,
        accessKeyId: process.env.ALIYUN_AK_ID!,
        accessKeySecret: process.env.ALIYUN_AK_SECRET!,
        bucket: process.env.OSS_BUCKET!,
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
            
              const uploadResult = await uploadToOSS(imageBuffer, resourcePath);
            
            timer.mark(`resourceUploadEnd-${normalizedPath}`);
            log('DEBUG', requestId, `✅ 资源上传成功: ${resourcePath}, 耗时: ${timer.getElapsed(`resourceUploadEnd-${normalizedPath}`) - timer.getElapsed(`resourceUpload-${normalizedPath}`)}ms`);

            resourceUploads.push({
              book_id: bookId,
              original_path: normalizedPath,
                oss_path: uploadResult.url,
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
        
          // 修改为批量插入语法
          const query = `
            INSERT INTO book_resources 
              (book_id, original_path, oss_path, resource_type, mime_type)
            SELECT 
              $1::uuid,
              unnest($2::text[]),
              unnest($3::text[]),
              unnest($4::text[]),
              unnest($5::text[])
          `;

          const result = await transaction.unsafe<Array<{id: string}>>(
            query,
            [
              bookId,
              resourceUploads.map(r => r.original_path),
              resourceUploads.map(r => r.oss_path),
              resourceUploads.map(r => r.resource_type),
              resourceUploads.map(r => r.mime_type)
            ]
          );
        
        timer.mark('resourceSaveEnd');
          const resourceError = result.length === 0 ? new Error('Failed to insert resources') : null;
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

    if (stage === 4) {
      log('INFO', requestId, '📝 阶段4: 开始处理章节内容');
      timer.mark('stage4Start');
      
      if (!bookData) {
        log('ERROR', requestId, '❌ 缺少书籍数据');
        return NextResponse.json({ error: '缺少书籍数据' }, { status: 400 });
      }
      
      if (!bookData.chapters || !Array.isArray(bookData.chapters)) {
        log('ERROR', requestId, '❌ 书籍章节数据无效');
        return NextResponse.json({ error: '书籍章节数据无效' }, { status: 400 });
      }
      
      log('DEBUG', requestId, `📚 处理 ${bookData.chapters.length} 个章节`);
      
        // 预处理章节和块
        const chaptersWithBlocks = bookData.chapters.map((chapter: UploadChapter) => ({
              title: chapter.title,
          content: chapter.content,
          blocks: parseChapterContent(chapter.content)
        }));
        
        // 使用优化后的批量处理函数
        timer.mark('batchStart');
        const { chapterIds, blockCount } = await batchProcessChapters(
          requestId,
          bookId,
          userId,
          chaptersWithBlocks
        );
        timer.mark('batchEnd');
        
        log('INFO', requestId, `✅ 章节批处理完成，章节数: ${chapterIds.length}，内容块数: ${blockCount}，耗时: ${timer.getElapsed('batchEnd') - timer.getElapsed('batchStart')}ms`);

      const totalTime = timer.getElapsed();
      log('INFO', requestId, `✅ 书籍上传流程全部完成，总耗时: ${totalTime}ms`);
      log('INFO', requestId, `⏱️ 整体请求完成, 耗时: ${totalTime}ms`);

      return NextResponse.json({
        progress: 100,
          chapters: chapterIds.map((id: string, index: number): ChapterResult => ({
            id,
            title: bookData.chapters[index].title,
            order_index: index
          }))
      });
    }

    log('ERROR', requestId, `❌ 无效的处理阶段: ${stage}`);
    return NextResponse.json({ error: '无效的处理阶段' }, { status: 400 });
    });
  } catch (error: any) {
    const totalTime = timer.getElapsed();
    log('ERROR', requestId, `❌ 上传处理失败，总耗时: ${totalTime}ms`, error);
    log('INFO', requestId, `⏱️ 整体请求 完成, 耗时: ${totalTime}ms`);
    log('DEBUG', requestId, `📊 内存使用 (错误结束): ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
    
    return NextResponse.json(
      { error: error.message || '上传失败' },
      { status: 500 }
    );
  } finally {
    // 使用外部作用域的tempFilePath变量进行清理
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      log('DEBUG', requestId, `🧹 清理临时文件: ${tempFilePath}`);
    }
  }
}

// 修改streamFormData函数，使其在没有找到文件时也能返回有效结果（针对阶段4）
async function streamFormData(req: NextRequest, requestId: string, timer: Timer) {
  try {
    log('DEBUG', requestId, '⏱️ 开始流式处理表单数据');
    timer.mark('formStreamStart');
    
    // 直接使用FormData API而不是自己解析，避免二进制数据损坏
    // 但这需要先将请求流保存为文件
    const contentType = req.headers.get('content-type') || '';
    const tempDir = os.tmpdir();
    const tempFilePath = join(tempDir, `upload-${Date.now()}.tmp`);
    log('DEBUG', requestId, `📂 创建临时文件: ${tempFilePath}`);
    
    // 直接保存原始请求到临时文件
    const reader = req.body?.getReader();
    if (!reader) {
      log('ERROR', requestId, '❌ 无法读取请求体');
      return { error: '无法读取请求体' };
    }
    
    // 直接用原始二进制写入，避免任何转换或处理
    const writeStream = fs.createWriteStream(tempFilePath);
    let totalBytes = 0;
    
    log('DEBUG', requestId, `📝 开始写入原始请求数据到临时文件`);
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalBytes += value?.length || 0;
      // 直接写入二进制数据，不做任何转换或处理
      await new Promise<void>((resolve, reject) => {
        writeStream.write(value, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    writeStream.end();
    log('DEBUG', requestId, `✅ 原始请求数据写入完成，大小: ${totalBytes} 字节`);
    
    // 现在使用multipart包解析表单数据，而不是自己处理
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      log('ERROR', requestId, '❌ 无法识别表单边界');
      return { error: '无效的表单格式' };
    }
    
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    log('DEBUG', requestId, `🔍 表单边界: ${boundary}`);
    
    // 使用Buffer从文件读取数据，保持二进制完整性
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    // 手动解析multipart表单数据
    const fields: Record<string, string> = {};
    let epubFilePath: string | null = null;
    let fileName = '';
    
    // 使用更可靠的分隔方式处理表单
    const boundaryBuffer = Buffer.from(`--${boundary}\r\n`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--\r\n`);
    const lineBreak = Buffer.from('\r\n\r\n');
    
    let position = 0;
    let filePosition = -1;
    let fileEndPosition = -1;
    
    // 查找表单部分
    while (position < fileBuffer.length) {
      // 使用Buffer.prototype.indexOf的正确方式
      // 使用as unknown作为中间类型转换
      const boundaryPos = (fileBuffer as unknown as { indexOf(search: Buffer, offset: number): number }).indexOf(boundaryBuffer, position);
      if (boundaryPos === -1) break;
      
      position = boundaryPos + boundaryBuffer.length;
      
      // 检查是否是文件字段
      const headerEnd = (fileBuffer as unknown as { indexOf(search: Buffer, offset: number): number }).indexOf(lineBreak, position);
      if (headerEnd === -1) break;
      
      const header = fileBuffer.slice(position, headerEnd).toString('utf8');
      position = headerEnd + lineBreak.length;
      
      if (header.includes('filename="')) {
        // 这是文件字段
        const filenameMatch = header.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          fileName = filenameMatch[1];
          log('DEBUG', requestId, `🔍 检测到文件: ${fileName}`);
          
          // 记录文件开始位置
          filePosition = position;
          
          // 查找下一个边界位置
          const nextBoundary = fileBuffer.indexOf(`--${boundary}`, position);
          if (nextBoundary !== -1) {
            // 文件结束位置是下一个边界前面减去\r\n
            fileEndPosition = nextBoundary - 2;
            log('DEBUG', requestId, `📏 文件数据范围: ${filePosition} - ${fileEndPosition}`);
          }
        }
      } else if (header.includes('name="')) {
        // 这是普通字段
        const nameMatch = header.match(/name="([^"]+)"/);
        if (nameMatch) {
          const fieldName = nameMatch[1];
          
          // 查找字段结束位置
          const nextBoundaryPos = fileBuffer.indexOf(`--${boundary}`, position);
          if (nextBoundaryPos !== -1) {
            // 字段值前后有\r\n，需要去掉
            const fieldValue = fileBuffer.slice(position, nextBoundaryPos - 2).toString('utf8');
            fields[fieldName] = fieldValue;
            log('DEBUG', requestId, `📄 表单字段: ${fieldName}=${fieldValue.substring(0, 30)}${fieldValue.length > 30 ? '...' : ''}`);
          }
        }
      }
      
      // 查找下一个边界的开始位置
      const nextPartPos = fileBuffer.indexOf(`--${boundary}`, position);
      if (nextPartPos === -1) break;
      position = nextPartPos;
    }
    
    // 如果找到文件，将其提取到单独的文件
    if (filePosition !== -1 && fileEndPosition !== -1) {
      const epubTempPath = join(tempDir, `epub-${Date.now()}.epub`);
      const fileContent = fileBuffer.slice(filePosition, fileEndPosition);
      // 使用适当的类型转换
      fs.writeFileSync(epubTempPath, new Uint8Array(fileContent));
      epubFilePath = epubTempPath;
      
      log('DEBUG', requestId, `📦 提取EPUB文件到: ${epubTempPath}, 大小: ${fileContent.length} 字节`);
      
      // 验证文件完整性
      try {
        // 读取前4个字节检查文件头
        const header = fileContent.slice(0, 4);
        const isPK = header[0] === 0x50 && header[1] === 0x4B; // PK是ZIP文件的标识
        log('DEBUG', requestId, `🔍 文件头检查: ${isPK ? 'ZIP格式有效' : '非标准ZIP格式'}, 前4字节: ${header.toString('hex')}`);
        
        if (!isPK) {
          log('WARN', requestId, '⚠️ 文件可能不是有效的ZIP/EPUB格式');
        }
      } catch (error) {
        log('WARN', requestId, '⚠️ 无法验证文件格式', error);
      }
    } else {
      log('WARN', requestId, '⚠️ 未能在表单中找到文件数据');
    }
    
    timer.mark('formStreamEnd');
    log('INFO', requestId, `✅ 表单流处理完成，读取 ${totalBytes} 字节，耗时: ${timer.getElapsed('formStreamEnd') - timer.getElapsed('formStreamStart')}ms`);
    
    // 获取阶段信息
    const stage = Number(fields.stage || '0');
    
    // 修改：如果是阶段4，即使没有文件也继续处理
    if (!epubFilePath && stage === 4) {
      log('INFO', requestId, '📝 阶段4处理，不需要文件上传');
      return { fields, filePath: '', file: null };
    } 
    // 其他阶段如果没有文件则返回错误
    else if (!epubFilePath) {
      log('ERROR', requestId, '❌ 处理表单后未找到有效的EPUB文件');
      return { error: '未找到有效的EPUB文件' };
    }
    
    // 创建类似File对象的接口
    const file = {
      name: fileName,
      size: fs.statSync(epubFilePath).size,
      type: 'application/epub+zip',
      arrayBuffer: async () => {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          fs.readFile(epubFilePath!, (err, data) => {
            if (err) reject(err);
            else {
              // 直接返回整个Buffer的ArrayBuffer
              resolve(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
            }
          });
        });
      }
    };
    
    return { fields, filePath: epubFilePath, file };
  } catch (error: any) {
    log('ERROR', requestId, `❌ 表单流处理失败`, error);
    return { error: error.message || '表单处理失败' };
  }
}

// 然后修改接口定义来包含file属性
interface FormDataResponse {
  fields: Record<string, string>;
  filePath: string;
  file?: {
    name: string;
    size: number;
    type: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
  } | null;
  error?: string;
}

// 1. 修复数据库查询返回类型
interface BookInsertResult extends Array<{id: string}> {
  error?: any;
}

// 2. 修复资源插入的类型
interface ResourceInsertResult extends Array<{id: string}> {
  count: number;
  error?: any;
}

// 3. 导出 batchProcessChapters
export { batchProcessChapters } from '@/lib/supabase-pool';

// 4. 添加类型定义
interface ChapterResult {
  id: string;
  title: string;
  order_index: number;
} 