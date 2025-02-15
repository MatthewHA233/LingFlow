import { NextResponse } from 'next/server'
import OSS from 'ali-oss'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  
  // 配置OSS客户端
  const client = new OSS({
    region: 'oss-cn-beijing',
    accessKeyId: process.env.ALIYUN_AK_ID!,
    accessKeySecret: process.env.ALIYUN_AK_SECRET!,
    bucket: 'chango-url',
    secure: true // 强制使用HTTPS
  })

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `audio/${Date.now()}_${file.name}`
    
    // 上传到OSS
    console.log('开始上传文件:', filename)
    const result = await client.put(filename, buffer)
    console.log('上传成功:', result)
    return NextResponse.json({
      fileLink: result.res.requestUrls?.[0]?.replace('http://', 'https://') // 强制使用HTTPS
    })
  } catch (error) {
    console.error('OSS上传错误:', error)
    return NextResponse.json(
      { error: '上传失败', details: error.message },
      { status: 500 }
    )
  }
} 