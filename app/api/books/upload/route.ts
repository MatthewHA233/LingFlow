import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import crypto from 'crypto'
import JSZip from 'jszip'
import { processChapterContent, normalizePath, getMimeType } from '@/lib/content-processor'
import { NextRequest } from 'next/server'
import fs from 'fs'

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

// 修改POST处理函数
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      return await handleFormUpload(req);
    }
    return await streamHandler(req);
  } catch (error: any) {
    console.error('上传处理失败:', error);
    return NextResponse.json(
      { error: error.message || '上传失败' },
      { status: 500 }
    );
  }
}

// 原有的表单处理函数
async function handleFormUpload(req: NextRequest) {
  try {
    const formData = await req.formData();
    const stage = Number(formData.get('stage'));
    const userId = formData.get('userId') as string;
    const bookId = formData.get('bookId') as string;
    
    // 第一阶段：验证用户和初始化 (0-30%)
    if (stage === 1) {
      const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return NextResponse.json({ error: '未授权访问' }, { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
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
      
      const { default: OSS } = await import('ali-oss');
    const client = new OSS({
      region: 'oss-cn-beijing',
        accessKeyId: process.env.ALIYUN_AK_ID || '',
        accessKeySecret: process.env.ALIYUN_AK_SECRET || '',
      bucket: 'chango-url',
      secure: true
      });

      const baseDir = `books/${userId}/${bookId}`;
      const epubPath = `${baseDir}/${path.basename(file.name)}`;
      const arrayBuffer = await file.arrayBuffer();
      const epubBuffer = Buffer.from(arrayBuffer);
    const epubResult = await client.put(epubPath, epubBuffer, {
      mime: 'application/epub+zip',
        headers: { 'Cache-Control': 'max-age=31536000' }
      });

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

      if (bookError) throw bookError;

      return NextResponse.json({
        progress: 50,
        book: savedBook
      });
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
        await supabase.from('book_resources').insert(resourceUploads);
      }

      return NextResponse.json({
        progress: 70,
        resources: resourceUploads
      });
    }

    // 第四阶段：处理章节内容 (70-100%)
    if (stage === 4) {
      const bookData = JSON.parse(formData.get('bookData') as string);
      const chapterPromises = bookData.chapters.map(async (chapter: UploadChapter, i: number) => {
        try {
          const { data: contentParent } = await supabase
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

          if (!contentParent) throw new Error('创建 content_parent 失败');

          const { data: savedChapter } = await supabase
            .from('chapters')
            .insert({
              book_id: bookId,
              title: chapter.title,
              order_index: i,
              parent_id: contentParent.id
            })
            .select()
            .single();

          if (!savedChapter) throw new Error('创建 chapter 失败');

          const blocks = parseChapterContent(chapter.content);
          const batchSize = 50;
          const blockPromises = [];
          
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
          return savedChapter;
        } catch (error) {
          console.error(`处理第 ${i + 1} 章时出错:`, error);
          throw error;
        }
      });

      const savedChapters = await Promise.all(chapterPromises);

      return NextResponse.json({
        progress: 100,
        chapters: savedChapters
      });
    }

    return NextResponse.json({ error: '无效的处理阶段' }, { status: 400 });
  } catch (error: any) {
    console.error('上传处理失败:', error);
    return NextResponse.json(
      { error: error.message || '上传失败' },
      { status: 500 }
    );
  }
} 