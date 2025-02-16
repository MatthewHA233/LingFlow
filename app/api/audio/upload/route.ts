import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    // 动态导入 ali-oss
    const { default: OSS } = await import('ali-oss')
    
    const client = new OSS({
      region: 'oss-cn-beijing',
      accessKeyId: process.env.ALIYUN_AK_ID!,
      accessKeySecret: process.env.ALIYUN_AK_SECRET!,
      bucket: 'chango-url',
      secure: true
    })

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `audio/${Date.now()}_${file.name}`
    
    const result = await client.put(filename, buffer)
    
    return NextResponse.json({
      fileLink: result.url.replace('http://', 'https://')
    })
  } catch (error) {
    console.error('上传失败:', error)
    return NextResponse.json(
      { error: '上传失败', details: (error as Error).message },
      { status: 500 }
    )
  }
} 