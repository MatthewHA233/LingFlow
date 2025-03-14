import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deleteOSSDirectory } from '@/lib/oss-client'

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

export async function DELETE(req: Request) {
  const startTime = Date.now();
  const logStep = (step: string) => {
    console.log(`[${Date.now() - startTime}ms] ${step}`);
  };

  try {
    logStep('开始删除流程');

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
    logStep('用户验证完成');

    // 2. 获取要删除的书籍ID
    const { bookId } = await req.json()
    if (!bookId) {
      return NextResponse.json({ error: '缺少书籍ID' }, { status: 400 })
    }

    // 3. 验证书籍所有权并获取完整信息
    logStep('开始验证书籍所有权');
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .eq('user_id', user.id)
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: '未找到该书籍或无权限删除' }, { status: 403 })
    }
    logStep('书籍验证完成');

    // 4. 删除OSS资源
    logStep('开始删除OSS资源');

    // 4.1 获取所有相关的语音识别任务
    logStep('获取语音识别任务');
    const { data: speechResults } = await supabase
      .from('speech_results')
      .select('id, audio_url')
      .eq('book_id', bookId);

    // 4.2 删除书籍主目录（包含 EPUB、资源等）
    logStep('删除书籍主目录');
    await deleteOSSDirectory(`books/${user.id}/${bookId}/`);

    // 4.3 删除所有相关的音频文件
    if (speechResults && speechResults.length > 0) {
      logStep(`开始删除 ${speechResults.length} 个音频文件`);
      for (const result of speechResults) {
        if (result.audio_url) {
          const audioPath = new URL(result.audio_url).pathname.slice(1);
          await deleteOSSDirectory(audioPath.split('/').slice(0, -1).join('/') + '/');
        }
      }
      logStep('音频文件删除完成');
    }

    // 5. 删除数据库记录
    logStep('开始删除数据库记录');

    // 5.1 删除context_blocks
    logStep('开始删除章节相关数据');
    const { data: chapters } = await supabase
      .from('chapters')
      .select('parent_id')
      .eq('book_id', bookId)

    if (chapters) {
      const parentIds = chapters.map(c => c.parent_id)
      logStep(`找到 ${chapters.length} 个章节需要删除`);
      
      // 首先删除内容块
      logStep('删除内容块');
      await supabase
        .from('context_blocks')
        .delete()
        .in('parent_id', parentIds)

      // 然后删除content_parents
      logStep('删除content_parents');
      await supabase
        .from('content_parents')
        .delete()
        .in('id', parentIds)

      // 最后删除章节
      logStep('删除章节');
      await supabase
        .from('chapters')
        .delete()
        .eq('book_id', bookId)
    }

    // 5.2 删除语音识别结果
    logStep('删除语音识别结果');
    await supabase
      .from('speech_results')
      .delete()
      .eq('book_id', bookId)

    // 5.3 删除资源记录
    logStep('删除资源记录');
    await supabase
      .from('book_resources')
      .delete()
      .eq('book_id', bookId)

    // 5.4 最后删除书籍记录
    logStep('删除书籍记录');
    await supabase
      .from('books')
      .delete()
      .eq('id', bookId)

    const totalTime = Date.now() - startTime;
    logStep(`删除流程完成，总耗时: ${totalTime}ms`);

    return NextResponse.json({ 
      message: '书籍及相关资源删除成功',
      bookId,
      totalTime
    })

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`删除书籍失败 (耗时: ${totalTime}ms):`, error)
    return NextResponse.json(
      { error: '删除书籍失败', details: (error as Error).message },
      { status: 500 }
    )
  }
} 