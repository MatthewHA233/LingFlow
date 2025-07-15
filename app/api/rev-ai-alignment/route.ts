import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { audioUrl, transcript, speechId } = await request.json()
    
    if (!audioUrl || !transcript) {
      return NextResponse.json(
        { error: '需要提供音频URL和文本转录' },
        { status: 400 }
      )
    }

    const REV_AI_TOKEN = process.env.REV_AI_Access_Token
    
    if (!REV_AI_TOKEN) {
      return NextResponse.json(
        { error: 'Rev AI访问令牌未配置' },
        { status: 500 }
      )
    }

    console.log('开始Rev AI强制对齐处理:', { 
      audioUrl, 
      transcriptLength: transcript.length,
      transcriptPreview: transcript.substring(0, 100) + '...',
      transcriptWordCount: transcript.split(/\s+/).length
    })

    // 第一步：提交强制对齐任务 - 使用正确的强制对齐API
    const requestBody = {
      source_config: {
        url: audioUrl
      },
      transcript_text: transcript, // 直接传递文本，不使用嵌套对象
      language: 'en'
    }
    
    console.log('发送到Rev AI的请求体:', JSON.stringify(requestBody, null, 2))
    
    const submitResponse = await fetch('https://api.rev.ai/alignment/v1/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REV_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!submitResponse.ok) {
      const errorData = await submitResponse.json()
      console.error('提交Rev AI强制对齐任务失败:', {
        status: submitResponse.status,
        statusText: submitResponse.statusText,
        error: errorData
      })
      return NextResponse.json(
        { error: `提交强制对齐任务失败: ${errorData.title || errorData.detail || '未知错误'}` },
        { status: submitResponse.status }
      )
    }

    const submitData = await submitResponse.json()
    const jobId = submitData.id

    console.log('Rev AI强制对齐任务已提交:', {
      jobId,
      submitData
    })

    // 第二步：轮询任务状态
    let attempts = 0
    const maxAttempts = 60 // 最多等待5分钟
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // 等待5秒
      
      const statusResponse = await fetch(`https://api.rev.ai/alignment/v1/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${REV_AI_TOKEN}`,
        }
      })

      if (!statusResponse.ok) {
        console.error('查询任务状态失败:', statusResponse.status)
        attempts++
        continue
      }

      const statusData = await statusResponse.json()
      console.log('任务状态:', statusData.status)

      if (statusData.status === 'completed') {
        // 第三步：获取强制对齐结果
        const transcriptResponse = await fetch(`https://api.rev.ai/alignment/v1/jobs/${jobId}/transcript`, {
          headers: {
            'Authorization': `Bearer ${REV_AI_TOKEN}`,
            'Accept': 'application/vnd.rev.transcript.v1.0+json'
          }
        })

        if (!transcriptResponse.ok) {
          throw new Error('获取对齐结果失败')
        }

        const transcriptData = await transcriptResponse.json()
        
        // 详细分析返回的结果
        console.log('Rev AI强制对齐结果分析:', {
          hasMonologues: !!transcriptData.monologues,
          monologueCount: transcriptData.monologues?.length || 0,
          totalElements: transcriptData.monologues?.reduce((sum: number, mono: any) => 
            sum + (mono.elements?.length || 0), 0) || 0,
          textElements: transcriptData.monologues?.reduce((sum: number, mono: any) => 
            sum + (mono.elements?.filter((el: any) => el.type === 'text')?.length || 0), 0) || 0,
          punctElements: transcriptData.monologues?.reduce((sum: number, mono: any) => 
            sum + (mono.elements?.filter((el: any) => el.type === 'punct')?.length || 0), 0) || 0,
          firstFewWords: transcriptData.monologues?.[0]?.elements
            ?.filter((el: any) => el.type === 'text')
            ?.slice(0, 10)
            ?.map((el: any) => el.value) || []
        })
        
        console.log('Rev AI强制对齐完成，返回结果')
        
        return NextResponse.json({
          success: true,
          jobId: jobId,
          status: 'completed',
          result: transcriptData
        })
        
      } else if (statusData.status === 'failed') {
        throw new Error(`Rev AI强制对齐失败: ${statusData.failure_detail || '未知错误'}`)
      }
      
      attempts++
    }
    
    // 超时处理
    return NextResponse.json(
      { error: '处理超时，请稍后重试' },
      { status: 408 }
    )
    
  } catch (error) {
    console.error('Rev AI处理错误:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 }
    )
  }
} 