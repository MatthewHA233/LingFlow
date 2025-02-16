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

export async function parseEpub(file: File): Promise<Book> {
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
          size: zipFile._data ? zipFile._data.uncompressedSize : 'unknown'
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

    // 改进资源清单处理
    const imageResources = Object.entries(manifest).filter(([key, item]: [string, any]) => {
      const isImage = item.type?.startsWith('image/');
      if (isImage) {
        console.log('资源清单中的图片:', {
          key,
          href: item.href,
          type: item.type,
          id: item.id
        });
      }
      return isImage;
    });

    // 尝试读取每个图片资源的内容
    for (const [key, item] of imageResources) {
      try {
        // 尝试不同的路径组合来查找图片
        const possiblePaths = [
          item.href,                    // 原始路径
          item.href.replace(/^\//, ''), // 移除开头的斜杠
          `OEBPS/${item.href}`,        // OEBPS目录下
          `OPS/${item.href}`,          // OPS目录下
        ];

        // 打印所有文件以便调试
        console.log('ZIP中的所有文件:', Object.keys(zip.files));
        
        // 尝试所有可能的路径
        let imageFile = null;
        for (const testPath of possiblePaths) {
          console.log(`尝试路径: ${testPath}`);
          imageFile = zip.file(testPath);
          if (imageFile) {
            console.log(`找到图片文件: ${testPath}`);
            break;
          }
        }

        if (imageFile) {
          // 使用 async 方法获取文件大小
          const blob = await imageFile.async('blob');
          console.log(`图片文件 ${item.href} 大小:`, blob.size, 'bytes');
        } else {
          // 如果所有路径都失败，记录更详细的错误信息
          console.warn(`未找到图片文件: ${item.href}，尝试过的路径:`, possiblePaths);
        }
      } catch (error) {
        console.error(`读取图片 ${item.href} 失败:`, error);
      }
    }

    const now = new Date().toISOString();
    
    const processResources = async () => {
      const resources: Record<string, any> = {};
      const manifest = await book.loaded.manifest;
      
      // 获取基础路径
      const opfPath = (book as any).packaging?.path || '';
      const basePath = path.dirname(opfPath) || 'OEBPS';
      console.log('OPF文件路径:', opfPath);
      console.log('基础路径:', basePath);

      for (const [id, item] of Object.entries(manifest)) {
        if (item.type?.startsWith('image/')) {
          // 规范化图片路径
          const href = item.href.replace(/\\/g, '/').replace(/^\//, '');
          const absolutePath = path.join(basePath, href).replace(/\\/g, '/');
          
          console.log('处理图片资源:', {
            id,
            originalHref: item.href,
            normalizedPath: absolutePath,
            type: item.type
          });

          // 验证文件是否存在
          const imageFile = zip.file(absolutePath) || zip.file(href);
          if (imageFile) {
            resources[id] = {
              ...item,
              href: absolutePath,
              exists: true
            };
          } else {
            console.warn(`未找到图片文件: ${absolutePath}`);
            resources[id] = {
              ...item,
              href: absolutePath,
              exists: false
            };
          }
        }
      }

      return resources;
    };

    const processedResources = await processResources();
    console.log('处理后的资源:', processedResources);

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
        manifest: processedResources
      },
      metadata: {
        language: metadata.language,
        publisher: metadata.publisher,
        published_date: metadata.pubdate,
      }
    };
  } catch (error) {
    console.error('EPUB解析详细错误:', {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
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

async function getChapters(book: EpubBook): Promise<Chapter[]> {
  const chapters: Chapter[] = [];
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
      
      // 使用独立的 div 包装图片
      return `\n\n<div class="book-image">![${alt}](${absolutePath})</div>\n\n`;
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