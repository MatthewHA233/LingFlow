import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import crypto from 'crypto'
import JSZip from 'jszip'

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

    // 6. 上传章节Markdown文件
    console.log('开始上传章节文件')
    const chapterUploads = await Promise.all(
      bookData.chapters.map(async (chapter: any, index: number) => {
        const chapterPath = `${baseDir}/chapters/${(index + 1).toString().padStart(3, '0')}.md`
        const chapterBuffer = Buffer.from(chapter.content)
        const result = await client.put(chapterPath, chapterBuffer, {
          mime: 'text/markdown',
          headers: {
            'Cache-Control': 'max-age=31536000'
          }
        })
        return {
          ...chapter,
          order_index: index,
          oss_path: result.url.replace('http://', 'https://')
        }
      })
    )
    console.log('章节文件上传完成')

    // 7. 处理资源文件
    console.log('开始处理资源文件')
    const resourceUploads = []
    if (bookData.resources?.imageFiles?.length > 0) {
      console.log(`找到 ${bookData.resources.imageFiles.length} 个资源文件`)
      
      // 解压EPUB文件以获取图片
      const epubZip = await JSZip.loadAsync(await file.arrayBuffer());
      
      for (const resource of bookData.resources.imageFiles) {
        if (resource.exists && resource.href) {
          const resourcePath = `${baseDir}/resources/${path.basename(resource.href)}`
          
          try {
            // 从EPUB中读取图片文件
            const imageFile = epubZip.file(resource.href);
            if (imageFile) {
              // 获取图片数据
              const imageBuffer = await imageFile.async('nodebuffer');
              
              // 上传到OSS
              const imageResult = await client.put(resourcePath, imageBuffer, {
                mime: resource.type || 'image/jpeg',
                headers: {
                  'Cache-Control': 'max-age=31536000'
                }
              });
              
              console.log('图片上传成功:', {
                href: resource.href,
                path: resourcePath,
                size: imageBuffer.length,
                url: imageResult.url
              });
              
              resourceUploads.push({
                book_id: bookId,
                original_path: resource.href,
                oss_path: imageResult.url.replace('http://', 'https://'),
                resource_type: 'image',
                mime_type: resource.type || 'image/jpeg'
              });
            } else {
              console.warn('未找到图片文件:', resource.href);
            }
          } catch (error: any) {
            console.error('处理图片失败:', {
              href: resource.href,
              error: error.message
            });
          }
        }
      }
    }
    console.log(`处理了 ${resourceUploads.length} 个资源文件`)

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
    const chaptersData = chapterUploads.map(chapter => ({
      book_id: bookId,
      title: chapter.title,
      content: chapter.content,
      order_index: chapter.order_index,
      oss_path: chapter.oss_path
    }))
    console.log('准备插入的章节数据:', chaptersData.length, '条')

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