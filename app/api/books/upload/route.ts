import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import crypto from 'crypto'
import JSZip from 'jszip'
import { processChapterContent, normalizePath, getMimeType } from '@/lib/content-processor'

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

export async function POST(req: Request) {
  try {
    console.log('开始处理上传请求')
    
    // 1. 验证用户身份
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('未找到授权头')
      return NextResponse.json({ error: '未授权访问', code: 'no_token' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 直接使用传入的token验证用户
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError) {
      console.error('用户验证失败:', userError)
      
      // 如果是token过期错误，返回特定的错误码
      if (userError.message?.includes('token is expired') || userError.message?.includes('invalid JWT')) {
        return NextResponse.json({ 
          error: '会话已过期，请重新登录', 
          code: 'session_expired' 
        }, { status: 401 })
      }
      
      return NextResponse.json({ 
        error: '用户验证失败', 
        code: 'user_error',
        message: userError.message 
      }, { status: 401 })
    }

    if (!user) {
      console.error('未找到用户信息')
      return NextResponse.json({ 
        error: '未找到用户信息', 
        code: 'user_not_found' 
      }, { status: 401 })
    }

    console.log('用户验证成功:', user.id)

    // 2. 获取上传的文件和数据
    const formData = await req.formData()
    const file = formData.get('file') as File
    const bookDataStr = formData.get('bookData') as string
    
    if (!file || !bookDataStr) {
      console.log('缺少必要的上传数据')
      return NextResponse.json({ error: '缺少必要的上传数据' }, { status: 400 })
    }

    const bookData = JSON.parse(bookDataStr)
    console.log('接收到书籍数据:', {
      title: bookData.title,
      chaptersCount: bookData.chapters.length,
      resourcesCount: bookData.resources?.imageFiles?.length || 0
    })

    // 3. 初始化OSS客户端
    console.log('初始化OSS客户端')
    const { default: OSS } = await import('ali-oss')
    const client = new OSS({
      region: 'oss-cn-beijing',
      accessKeyId: process.env.ALIYUN_AK_ID || '', // 确保有默认值
      accessKeySecret: process.env.ALIYUN_AK_SECRET || '', // 确保有默认值
      bucket: 'chango-url',
      secure: true
    })

    // 4. 生成唯一的书籍ID和基础路径
    const bookId = crypto.randomUUID()
    const baseDir = `books/${user.id}/${bookId}`
    const ossBaseUrl = `https://chango-url.oss-cn-beijing.aliyuncs.com/${baseDir}/resources`
    console.log('生成基础路径:', baseDir)

    // 5. 上传原始EPUB文件
    console.log('开始上传EPUB文件')
    const epubPath = `${baseDir}/${path.basename(file.name)}`
    const epubBuffer = Buffer.from(await file.arrayBuffer())
    const epubResult = await client.put(epubPath, epubBuffer, {
      mime: 'application/epub+zip',
      headers: {
        'Cache-Control': 'max-age=31536000'
      }
    })
    console.log('EPUB文件上传成功:', epubResult.url)

    // 6. 准备章节数据和处理资源文件
    console.log('开始准备章节数据和处理资源文件')
    const resourceUploads: BookResource[] = []
    const chapterResourceUploads = new Set<string>(); // 用于去重

    // 处理章节内容和提取资源
    const chaptersData = bookData.chapters.map((chapter: any, index: number) => {
      // 处理章节内容
      const { content } = processChapterContent(
        chapter.content,
        [] // 初始时没有资源，先传空数组
      );

      // 收集图片引用
      const imageMatches = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
      for (const match of imageMatches) {
        const [, , src] = match.match(/!\[(.*?)\]\((.*?)\)/) || [];
        if (src) {
          const normalizedPath = normalizePath(src);
          if (!chapterResourceUploads.has(normalizedPath)) {
            chapterResourceUploads.add(normalizedPath);
            resourceUploads.push({
              book_id: bookId,
              original_path: normalizedPath,
              oss_path: `https://chango-url.oss-cn-beijing.aliyuncs.com/${baseDir}/resources/${path.basename(normalizedPath)}`,
              resource_type: 'image',
              mime_type: getMimeType(normalizedPath)
            });
          }
        }
      }

      return {
        book_id: bookId,
        title: chapter.title,
        content: content,
        order_index: index
      };
    });

    // 处理原始的图片资源
    if (bookData.resources?.imageFiles?.length > 0) {
      console.log(`找到 ${bookData.resources.imageFiles.length} 个原始资源文件`);
      
      for (const resource of bookData.resources.imageFiles) {
        if (resource.exists && resource.href) {
          const normalizedPath = normalizePath(resource.href);
          // 检查是否已经在章节处理中添加过
          if (!chapterResourceUploads.has(normalizedPath)) {
            resourceUploads.push({
              book_id: bookId,
              original_path: normalizedPath,
              oss_path: `https://chango-url.oss-cn-beijing.aliyuncs.com/${baseDir}/resources/${path.basename(normalizedPath)}`,
              resource_type: 'image',
              mime_type: resource.type || getMimeType(normalizedPath)
            });
          }
        }
      }
    }

    // 上传所有资源文件
    if (resourceUploads.length > 0) {
      console.log(`开始上传 ${resourceUploads.length} 个资源文件`);
      
      // 解压EPUB文件以获取图片
      const epubZip = await JSZip.loadAsync(await file.arrayBuffer());
      
      // 列出所有文件用于调试
      console.log('EPUB中的文件列表:', Object.keys(epubZip.files));
      
      for (const resource of resourceUploads) {
        try {
          // 尝试多种可能的路径
          const possiblePaths = [
            resource.original_path,
            `OEBPS/${resource.original_path}`,
            `OPS/${resource.original_path}`,
            resource.original_path.replace(/^OEBPS\//, ''),
            resource.original_path.replace(/^OPS\//, ''),
            `OEBPS/images/${path.basename(resource.original_path)}`,
            `OEBPS/image/${path.basename(resource.original_path)}`,
            `OPS/images/${path.basename(resource.original_path)}`,
            `OPS/image/${path.basename(resource.original_path)}`,
            `images/${path.basename(resource.original_path)}`,
            `image/${path.basename(resource.original_path)}`
          ];

          // 尝试找到图片文件
          let imageFile = null;
          let foundPath = '';
          for (const testPath of possiblePaths) {
            imageFile = epubZip.file(testPath);
            if (imageFile) {
              foundPath = testPath;
              console.log(`找到图片文件: ${testPath} (原始路径: ${resource.original_path})`);
              break;
            }
          }

          if (!imageFile) {
            // 如果还是找不到，尝试通过文件名在所有文件中搜索
            const targetFileName = path.basename(resource.original_path).toLowerCase();
            const matchingFile = Object.keys(epubZip.files).find(
              filePath => path.basename(filePath).toLowerCase() === targetFileName
            );

            if (matchingFile) {
              imageFile = epubZip.file(matchingFile);
              foundPath = matchingFile;
              console.log(`通过文件名找到图片: ${matchingFile} (原始路径: ${resource.original_path})`);
            }
          }

          if (imageFile) {
            // 获取图片数据
            const imageBuffer = await imageFile.async('nodebuffer');
            
            // 从资源路径中提取实际的文件路径
            const resourcePath = resource.oss_path.replace('https://chango-url.oss-cn-beijing.aliyuncs.com/', '');
            
            // 上传到OSS
            const imageResult = await client.put(resourcePath, imageBuffer, {
              mime: resource.mime_type,
              headers: {
                'Cache-Control': 'max-age=31536000'
              }
            });
            
            console.log('图片上传成功:', {
              originalPath: resource.original_path,
              foundPath: foundPath,
              size: imageBuffer.length,
              url: imageResult.url
            });
            
            // 更新资源的OSS路径
            resource.oss_path = imageResult.url.replace('http://', 'https://');
          } else {
            console.warn('未找到图片文件:', {
              originalPath: resource.original_path,
              triedPaths: possiblePaths
            });
          }
        } catch (error: any) {
          console.error('处理图片失败:', {
            path: resource.original_path,
            error: error.message
          });
        }
      }
    }
    console.log(`处理了 ${resourceUploads.length} 个资源文件`);

    // 8. 保存书籍信息到数据库
    console.log('开始保存书籍信息')
    const bookInsertData = {
      id: bookId,
      title: bookData.title,
      author: bookData.author,
      epub_path: epubResult.url.replace('http://', 'https://'),
      user_id: user.id,
      metadata: bookData.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cover_url: bookData.coverUrl || '',
      audio_path: '',
      description: bookData.metadata?.description || ''
    }
    console.log('准备插入的书籍数据:', bookInsertData)

    const { data: savedBook, error: bookError } = await supabase
      .from('books')
      .insert([bookInsertData])
      .select('id, title, author, epub_path, user_id, created_at, updated_at, cover_url, audio_path, metadata')
      .single()

    if (bookError) {
      console.error('保存书籍信息失败:', bookError)
      throw bookError
    }
    console.log('书籍信息保存成功:', savedBook.id)

    // 9. 保存章节信息
    console.log('开始保存章节信息')
    const { error: chaptersError } = await supabase
      .from('chapters')
      .insert(chaptersData)

    if (chaptersError) {
      console.error('保存章节信息失败:', chaptersError)
      throw chaptersError
    }
    console.log('章节信息保存成功')

    // 10. 保存资源信息
    if (resourceUploads.length > 0) {
      console.log('开始保存资源信息')
      const { error: resourcesError } = await supabase
        .from('book_resources')
        .insert(resourceUploads)

      if (resourcesError) {
        console.error('保存资源信息失败:', resourcesError)
        throw resourcesError
      }
      console.log('资源信息保存成功')
    }

    return NextResponse.json({
      message: '上传成功',
      book: savedBook,
      resources: resourceUploads
    })
    
  } catch (error: any) {
    console.error('上传处理失败:', error)
    return NextResponse.json(
      { error: error.message || '上传失败' },
      { status: 500 }
    )
  }
} 