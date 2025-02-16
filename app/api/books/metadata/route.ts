import { NextResponse } from 'next/server';
import EPub from 'epub';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const epubFile = formData.get('epub') as File;

    if (!epubFile) {
      return NextResponse.json(
        { error: '未找到 EPUB 文件' },
        { status: 400 }
      );
    }

    // 将文件保存到临时目录
    const buffer = Buffer.from(await epubFile.arrayBuffer());
    const tempPath = join(tmpdir(), `${Date.now()}-${epubFile.name}`);
    await writeFile(tempPath, buffer);

    // 解析 EPUB
    const epub = new EPub(tempPath);

    return new Promise<NextResponse>((resolve) => {
      epub.parse();

      epub.on('end', async () => {
        // 获取封面图片
        let coverUrl = '';
        if (epub.metadata.cover) {
          const coverPath = epub.manifest[epub.metadata.cover].href;
          const coverBuffer = await epub.getImage(coverPath);
          // 将封面图片转换为 base64
          coverUrl = `data:image/jpeg;base64,${coverBuffer.toString('base64')}`;
        }

        resolve(
          NextResponse.json({
            title: epub.metadata.title,
            creator: epub.metadata.creator,
            description: epub.metadata.description,
            language: epub.metadata.language,
            publisher: epub.metadata.publisher,
            date: epub.metadata.date,
            identifier: epub.metadata.identifier,
            cover_url: coverUrl
          })
        );
      });

      epub.on('error', (error) => {
        resolve(
          NextResponse.json(
            { error: '解析 EPUB 文件失败' },
            { status: 500 }
          )
        );
      });
    });
  } catch (error) {
    console.error('处理 EPUB 文件失败:', error);
    return NextResponse.json(
      { error: '处理 EPUB 文件失败' },
      { status: 500 }
    );
  }
} 