import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { uploadToOSS } from '@/lib/oss-client'

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

export async function POST(req: Request) {
  try {
    // 1. 验证用户身份
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 })
    }

    // 2. 获取上传文件和书籍ID
    const formData = await req.formData()
    const file = formData.get('file') as File
    const bookId = formData.get('bookId') as string
    
    if (!file || !bookId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    
    // 3. 使用原来的路径格式
    const filename = `audio/${bookId}/${Date.now()}_${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // 使用 uploadToOSS 但保持原来的路径格式
    const uploadResult = await uploadToOSS(buffer, filename)
    const audioUrl = uploadResult.url

    // 4. 创建语音识别任务记录
    const { data: speechResult, error: createError } = await supabase
      .from('speech_results')
      .insert({
        task_id: `task_${Date.now()}`,
        audio_url: audioUrl,
        user_id: user.id,
        status: 'uploaded',
        error_message: null
      })
      .select()
      .single()

    if (createError) {
      console.error('创建语音识别任务失败:', createError)
      return NextResponse.json({ error: '创建语音识别任务失败' }, { status: 500 })
    }

    // 5. 更新数据库中的音频路径
    const { error: updateError } = await supabase
      .from('books')
      .update({ 
        audio_path: audioUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookId)

    if (updateError) {
      console.error('更新数据库失败:', updateError)
      return NextResponse.json({ error: '更新数据库失败' }, { status: 500 })
    }
    
    return NextResponse.json({
      fileLink: audioUrl,
      speechId: speechResult.id,
      message: '上传成功'
    })
  } catch (error) {
    console.error('上传失败:', error)
    return NextResponse.json(
      { error: '上传失败', details: (error as Error).message },
      { status: 500 }
    )
  }
} 