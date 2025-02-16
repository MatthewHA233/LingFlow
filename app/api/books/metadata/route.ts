import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import JSZip from 'jszip';

// 更新类型定义
interface EPubMetadata {
  title?: string;
  creator?: string;
  author?: string;
  language?: string;
  cover?: string;
  [key: string]: any;
}

interface EPubManifest {
  cover?: string | {
    href: string;
    id?: string;
    'media-type'?: string;
  };
  [key: string]: any;
}

interface EPubInstance {
  metadata: EPubMetadata;
  manifest: EPubManifest;
  parse(): void;
  getImage(path: string): Promise<Buffer>;
  on(event: 'end', callback: () => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const epubFile = formData.get('epub') as File;

    if (!epubFile) {
      return NextResponse.json(
        { error: '未找到 EPUB 文件' },
        { status: 400 }
      );
    }

    const arrayBuffer = await epubFile.arrayBuffer();
    const { default: ePub } = await import('epubjs');
    const book = ePub(arrayBuffer);

    try {
      await book.ready;
      const metadata = await book.loaded.metadata;
      const manifest = await book.loaded.manifest;
      
      const result = {
        title: metadata.title || '未知标题',
        creator: metadata.creator || '未知作者',
        language: metadata.language || 'zh',
        cover: null as string | null
      };

      if (manifest.cover) {
        try {
          const zip = await JSZip.loadAsync(arrayBuffer);
          const coverHref = typeof manifest.cover === 'string' ? manifest.cover : manifest.cover?.href;
          if (coverHref) {
            const file = zip.file(coverHref);
            
            if (file) {
              const blob = await file.async('blob');
              result.cover = URL.createObjectURL(blob);
            }
          }
        } catch (error) {
          console.error('获取封面失败:', error);
        }
      }

      return NextResponse.json(result);
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('解析 EPUB 失败:', error);
    return NextResponse.json(
      { error: '解析 EPUB 失败', details: (error as Error).message },
      { status: 500 }
    );
  }
} 