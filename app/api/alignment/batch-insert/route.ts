import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 使用服务角色密钥的Supabase客户端
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

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 })
    }

    const alignmentData = await request.json()
    console.log('🚀 开始批量插入对齐数据:', {
      speechId: alignmentData.speechId,
      blocksCount: alignmentData.blocks?.length,
      totalSentences: alignmentData.totalSentences,
      totalWords: alignmentData.totalWords,
      userId: user.id
    })

    // 使用数据库事务确保数据一致性
    const { data: result, error } = await supabase.rpc('batch_insert_alignment_data', {
      alignment_data: alignmentData
    })

    if (error) {
      console.error('❌ 批量插入失败:', error)
      return NextResponse.json({ 
        error: `批量插入失败: ${error.message}`,
        details: error 
      }, { status: 500 })
    }

    console.log('✅ 批量插入成功:', result)
    
    return NextResponse.json({
      success: true,
      message: '批量插入完成',
      result: result,
      performance: {
        blocksProcessed: alignmentData.blocks?.length || 0,
        sentencesCreated: alignmentData.totalSentences || 0,
        wordsCreated: alignmentData.totalWords || 0
      }
    })

  } catch (error: any) {
    console.error('❌ 批量插入API错误:', error)
    return NextResponse.json({ 
      error: `服务器错误: ${error.message}` 
    }, { status: 500 })
  }
} 