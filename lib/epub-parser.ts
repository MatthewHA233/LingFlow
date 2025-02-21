import ePub, { Book as EpubBook } from 'epubjs';
import { Book, Chapter } from '@/types/book';
import JSZip from 'jszip';
import TurndownService from 'turndown';
import path from 'path';

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  // 检查是否在浏览器环境
  if (typeof window !== 'undefined') {
    // 浏览器环境使用 FileReader
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsArrayBuffer(file);
    });
  } else {
    // 服务器环境直接使用 arrayBuffer 方法
    return await file.arrayBuffer();
  }
}

interface UploadChapter {
  title: string;
  content: string;
}

interface ResourceItem {
  href: string;
  type?: string;
  id?: string;
  'media-type'?: string;
  exists?: boolean;
  properties?: string[];
}

interface LocalBook {
  id?: string;
  title: string;
  author: string;
  cover_url?: string;
  epub_path?: string;
  audio_path?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    language?: string;
    publisher?: string;
    published_date?: string;
    [key: string]: any;
  };
  chapters: UploadChapter[];
  coverUrl?: string;
  resources?: {
    manifest: Record<string, ResourceItem>;
  };
}

export async function parseEpub(file: File): Promise<LocalBook> {
  try {
    // 验证文件类型
    if (!file.type.includes('epub')) {
      throw new Error('无效的文件类型，请上传EPUB格式的电子书');
    }

    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // 验证文件内容并检查资源
    console.log('开始解析EPUB ZIP结构');
    const zip = await JSZip.loadAsync(arrayBuffer);
    const files = Object.keys(zip.files);
    console.log('EPUB文件列表:', files);

    // 检查图片文件
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      if (isImage) {
        const zipFile = zip.files[file];
        console.log('找到图片文件:', {
          path: file,
          extension: ext,
          size: zipFile ? (zipFile as any)._data?.uncompressedSize || 'unknown' : 'unknown'
        });
      }
      return isImage;
    });
    
    const book = ePub(arrayBuffer);
    
    try {
      await book.ready;
    } catch (error) {
      console.error('EPUB加载失败:', error);
      throw new Error('无法解析电子书文件，请确保文件格式正确');
    }

    const metadata = await book.loaded.metadata;
    const manifest = await book.loaded.manifest;
    console.log('资源清单:', manifest);

    // 改变imageResources的类型
    const imageResources: Array<[string, ResourceItem]> = [];

    // 从manifest中获取图片资源
    const manifestImages = Object.entries(manifest).filter(([_, item]) => 
      item.type?.startsWith('image/') || 
      ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => 
        item.href?.toLowerCase().endsWith(ext)
      )
    );

    // 处理manifest中的图片
    for (const [id, item] of manifestImages) {
      if (!item.href) continue;
      
      const href = item.href.replace(/\\/g, '/').replace(/^\//, '');
      imageResources.push([id, {
        href,
        type: item.type,
        id,
        'media-type': item.type,
        properties: [],
        exists: true
      }]);
    }

    // 如果没有找到图片，从文件列表添加
    if (imageResources.length === 0) {
      console.log('资源清单中没有图片，尝试从文件列表添加');
      imageFiles.forEach((file, index) => {
        const id = `image_${index}`;
        const href = file;
        const type = `image/${path.extname(file).slice(1)}`;
        imageResources.push([id, {
          href,
          type,
          id,
          'media-type': type,
          properties: [],
          exists: true
        }]);
        console.log('添加图片资源:', { id, href, type });
      });
    }

    // 转换为对象格式
    const processedResources = Object.fromEntries(imageResources);

    const now = new Date().toISOString();
    
    const processResources = async () => {
      const resources: Record<string, ResourceItem> = {};
      const manifest = await book.loaded.manifest;
      
      // 获取基础路径
      const opfPath = (book as any).packaging?.path || '';
      const basePath = path.dirname(opfPath) || 'OEBPS';
      console.log('OPF文件路径:', opfPath);
      console.log('基础路径:', basePath);

      // 获取所有图片文件
      const imageFiles = Object.keys(zip.files).filter(file => {
        const ext = path.extname(file).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
        if (isImage) {
          console.log('找到图片文件:', file);
        }
        return isImage;
      });
      console.log('找到的图片文件:', imageFiles);

      // 创建路径映射表
      const pathMapping = new Map<string, string>();
      imageFiles.forEach(file => {
        const normalized = file.replace(/\\/g, '/').toLowerCase();
        const basename = path.basename(normalized);
        pathMapping.set(normalized, file);
        pathMapping.set(basename, file);
      });

      // 合并manifest和文件系统中的图片资源
      const allImages = new Map<string, ResourceItem>();

      // 处理所有图片资源
      for (const [id, item] of imageResources) {
        if (!item.href) continue;
        
        const href = item.href.replace(/\\/g, '/').replace(/^\//, '');
        const normalizedHref = href.toLowerCase();
        const basename = path.basename(normalizedHref);
        
        // 尝试找到实际文件
        let actualPath = '';
        for (const testPath of [
          href,
          `${basePath}/${href}`,
          pathMapping.get(normalizedHref),
          pathMapping.get(basename),
          ...imageFiles.filter(f => path.basename(f).toLowerCase() === basename)
        ]) {
          if (testPath && zip.files[testPath]) {
            actualPath = testPath;
            break;
          }
        }

        if (actualPath) {
          console.log(`找到图片的实际路径: ${actualPath} (原始href: ${href})`);
          allImages.set(id, {
            href: actualPath,
            'media-type': item.type,
            type: item.type,
            exists: true,
            properties: []
          });
        }
      }

      // 验证并处理所有图片资源
      await Promise.all(Array.from(allImages).map(async ([id, item]) => {
        try {
          const imageFile = zip.file(item.href);
          if (imageFile) {
            const blob = await imageFile.async('blob');
            resources[id] = {
              href: item.href,
              'media-type': item['media-type'],
              type: item.type,
              exists: true,
              properties: []
            };
            console.log(`成功处理图片: ${item.href} (${blob.size} bytes)`);
          } else {
            console.warn(`图片文件不存在: ${item.href}`);
            resources[id] = {
              href: item.href,
              'media-type': item['media-type'],
              type: item.type,
              exists: false,
              properties: []
            };
          }
        } catch (error: any) {
          console.error(`处理图片失败: ${item.href}`, error);
          resources[id] = {
            href: item.href,
            'media-type': item['media-type'],
            type: item.type,
            exists: false,
            properties: []
          };
        }
      }));

      return resources;
    };

    const finalResources = await processResources();
    console.log('处理后的资源:', finalResources);

    return {
      id: crypto.randomUUID(),
      title: metadata.title || '未知标题',
      author: metadata.creator || '未知作者',
      cover_url: '',  // 将在后续步骤中更新
      created_at: now,
      updated_at: now,
      user_id: '',    // 将在后续步骤中更新
      epub_path: '',  // 将在后续步骤中更新
      audio_path: '', // 将在后续步骤中更新
      chapters: await getChapters(book),
      coverUrl: await getCoverUrl(book, arrayBuffer),
      resources: {
        manifest: finalResources
      },
      metadata: {
        language: metadata.language,
        publisher: metadata.publisher,
        published_date: metadata.pubdate,
      }
    };
  } catch (error: unknown) {
    console.error('EPUB解析详细错误:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // 根据错误类型返回不同的错误信息
    if (error instanceof Error) {
      if (error.message.includes('无效的文件类型')) {
        throw error;
      }
      if (error.message.includes('ZIP')) {
        throw new Error('EPUB文件损坏或格式不正确');
      }
    }
    throw new Error('无法解析电子书文件，请确保文件格式正确');
  }
}

async function getChapters(book: EpubBook): Promise<UploadChapter[]> {
  const chapters: UploadChapter[] = [];
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });

  // 修改图片处理规则
  turndownService.addRule('images', {
    filter: 'img',
    replacement: function(content, node) {
      const img = node as HTMLImageElement;
      let src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      
      // 规范化路径
      src = src.replace(/\\/g, '/').replace(/^\//, '');
      
      // 处理相对路径
      const opfPath = (book as any).packaging?.path || '';
      const basePath = path.dirname(opfPath) || 'OEBPS';
      const absolutePath = path.join(basePath, src).replace(/\\/g, '/');
      
      console.log('处理章节中的图片:', {
        original: src,
        normalized: absolutePath
      });
      
      // 使用独立的 div 包装图片，保留原始路径以便后续替换为 OSS URL
      return `\n\n<div class="book-image" data-original-path="${absolutePath}">![${alt}](${absolutePath})</div>\n\n`;
    }
  });

  // 获取目录结构用于标题匹配
  const toc = book.navigation?.toc || [];
  console.log('EPUB目录结构:', toc);

  // 使用目录结构来获取章节
  for (const tocItem of toc) {
    try {
      if (!tocItem.href) continue;

      // 移除锚点
      const href = tocItem.href.split('#')[0];
      
      const content = await book.load(href);
      const htmlContent = content instanceof Document ? new XMLSerializer().serializeToString(content) : String(content);
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      
      // 清理不需要的元素
      doc.querySelectorAll('script, style, nav').forEach(el => el.remove());
      
      // 转换正文内容
      const markdown = turndownService.turndown(doc.body);
      
      chapters.push({
        title: tocItem.label.trim(),
        content: markdown
      });
    } catch (error) {
      console.error('处理章节时出错:', error);
    }
  }
  
  return chapters;
}

async function getCoverUrl(book: EpubBook, buffer: ArrayBuffer): Promise<string | undefined> {
  try {
    const manifest = await book.loaded.manifest as Record<string, any>;
    const coverId = await book.loaded.cover;
    
    // 优先使用封面ID查找
    const coverItem = coverId ? manifest[coverId] : null;
    const coverHref = coverItem?.href || Object.values(manifest).find((item: any) => 
      item.href?.toLowerCase().includes('cover') &&
      item['media-type']?.startsWith('image/')
    )?.href;

    if (!coverHref) return undefined;

    // 规范化路径
    const basePath = (book as any).loaded.package?.metadata?.path || 'OEBPS/';
    const resolvePath = (href: string) => {
      return new URL(href, `http://epub.container/${basePath}`).pathname.replace(/^\//, '');
    };
    const fullPath = resolvePath(coverHref).replace(/\\/g, '/');

    const zip = await JSZip.loadAsync(buffer);
    const file = zip.file(fullPath);
    
    if (!file) {
      console.warn('封面文件未找到:', fullPath);
      // 尝试通过basename查找
      const fileName = path.basename(fullPath);
      const fallbackFile = zip.file(new RegExp(`${fileName}$`, 'i'))[0];
      if (!fallbackFile) return undefined;
      const blob = await fallbackFile.async('blob');
      return URL.createObjectURL(blob);
    }

    const blob = await file.async('blob');
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('获取封面失败:', error);
    return undefined;
  }
}

interface Resource {
  href: string;
  'media-type'?: string;
  id?: string;
  exists?: boolean;
  type?: string;
  oss_url?: string;  // 添加 OSS URL 字段
}