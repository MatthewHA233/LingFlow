import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToOSS } from '@/lib/oss-client';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req: Request) {
  try {
    // 1. 验证用户身份
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    // 2. 获取上传文件和笔记本ID
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const notebookId = formData.get('notebookId') as string;
    
    if (!file || !notebookId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 3. 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: '不支持的文件类型，请上传 JPG、PNG、WebP 或 GIF 格式的图片' 
      }, { status: 400 });
    }

    // 4. 验证文件大小 (最大5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: '文件大小不能超过5MB' 
      }, { status: 400 });
    }

    // 5. 验证笔记本是否属于当前用户
    const { data: notebook, error: notebookError } = await supabase
      .from('books')
      .select('id, user_id, type')
      .eq('id', notebookId)
      .eq('user_id', user.id)
      .eq('type', 'notebook')
      .single();

    if (notebookError || !notebook) {
      return NextResponse.json({ error: '笔记本不存在或无权限访问' }, { status: 403 });
    }

    // 6. 生成唯一文件名
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const uniqueId = crypto.randomUUID();
    const filename = `notebooks/${user.id}/${notebookId}/covers/${uniqueId}.${fileExtension}`;
    
    // 7. 上传到OSS
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadToOSS(buffer, filename);
    const imageUrl = uploadResult.url;

    // 8. 保存资源记录到数据库
    const { data: resourceRecord, error: resourceError } = await supabase
      .from('book_resources')
      .insert({
        book_id: notebookId,
        original_path: file.name,
        oss_path: imageUrl,
        resource_type: 'image',
        mime_type: file.type,
        metadata: {
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
          purpose: 'cover'
        }
      })
      .select()
      .single();

    if (resourceError) {
      console.error('保存资源记录失败:', resourceError);
      // 即使保存记录失败，也返回成功，因为文件已经上传
    }

    return NextResponse.json({
      imageUrl,
      resourceId: resourceRecord?.id,
      message: '图片上传成功'
    });

  } catch (error: any) {
    console.error('上传图片失败:', error);
    return NextResponse.json(
      { error: error.message || '上传失败，请重试' },
      { status: 500 }
    );
  }
} 