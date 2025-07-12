import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { audioUrl, transcript } = await request.json()
    
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

    // 第一步：提交强制对齐任务
    const submitResponse = await fetch('https://api.rev.ai/speechtotext/v1/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REV_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_url: audioUrl,
        options: {
          language: 'en',
          // 使用机器转录模式进行强制对齐
          force_alignment: {
            transcript: transcript
          }
        }
      })
    })

    if (!submitResponse.ok) {
      const errorData = await submitResponse.text()
      return NextResponse.json(
        { error: `Rev AI提交失败: ${errorData}` },
        { status: submitResponse.status }
      )
    }

    const jobData = await submitResponse.json()
    const jobId = jobData.id

    // 返回任务ID，让前端轮询状态
    return NextResponse.json({
      success: true,
      jobId: jobId,
      status: 'submitted',
      message: '强制对齐任务已提交，请等待处理完成'
    })

  } catch (error) {
    console.error('Rev AI API错误:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    
    if (!jobId) {
      return NextResponse.json(
        { error: '需要提供任务ID' },
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

    // 检查任务状态
    const statusResponse = await fetch(`https://api.rev.ai/speechtotext/v1/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${REV_AI_TOKEN}`,
      }
    })

    if (!statusResponse.ok) {
      const errorData = await statusResponse.text()
      return NextResponse.json(
        { error: `获取任务状态失败: ${errorData}` },
        { status: statusResponse.status }
      )
    }

    const statusData = await statusResponse.json()
    
    if (statusData.status === 'transcribed') {
      // 任务完成，获取对齐结果
      const resultResponse = await fetch(`https://api.rev.ai/speechtotext/v1/jobs/${jobId}/transcript`, {
        headers: {
          'Authorization': `Bearer ${REV_AI_TOKEN}`,
          'Accept': 'application/vnd.rev.transcript.v1.0+json'
        }
      })

      if (!resultResponse.ok) {
        const errorData = await resultResponse.text()
        return NextResponse.json(
          { error: `获取对齐结果失败: ${errorData}` },
          { status: resultResponse.status }
        )
      }

      const resultData = await resultResponse.json()
      
      return NextResponse.json({
        success: true,
        status: 'completed',
        result: resultData
      })
    } else {
      // 任务还在处理中
      return NextResponse.json({
        success: true,
        status: statusData.status,
        message: `任务状态: ${statusData.status}`,
        jobInfo: statusData
      })
    }

  } catch (error) {
    console.error('Rev AI API错误:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
} 