import ePub from 'epubjs';
import { Book } from '@/types/book';
import JSZip from 'jszip';
import TurndownService from 'turndown';

export async function parseEpub(file: File): Promise<Book> {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // 使用正确的EPUB初始化方式
    const book = ePub(arrayBuffer, {
      request: {
        config: {
          // 禁用外部请求
          requestCredentials: 'omit',
          // 启用本地资源解析
          allowLocalResources: true
        }
      }
    });

    await book.ready;

    // 生成临时资源基地址
    const virtualBaseUrl = `epub://${Date.now()}/`;

    return {
      title: book.package.metadata.title || '未知标题',
      author: book.package.metadata.creator || '未知作者',
      chapters: await getChapters(book, virtualBaseUrl),
      coverUrl: await getCoverUrl(book, arrayBuffer)
    };
  } catch (error) {
    console.error('EPUB解析详细错误:', error);
    throw new Error('无法解析电子书文件，请确保文件格式正确');
  }
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsArrayBuffer(file);
  });
}

async function getChapters(book: EpubBook, baseUrl: string): Promise<Chapter[]> {
  const chapters: Chapter[] = [];
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });

  // 自定义图片处理规则
  turndownService.addRule('images', {
    filter: 'img',
    replacement: function(content, node) {
      const img = node as HTMLImageElement;
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      // 保持原始src路径
      return `![${alt}](${src})`;
    }
  });

  // 获取目录结构用于标题匹配
  const toc = book.navigation?.toc || [];
  console.log('EPUB目录结构:', toc);

  for (const item of book.spine.items) {
    try {
      const content = await book.load(item.href);
      const htmlContent = typeof content === 'string' ? content : new XMLSerializer().serializeToString(content);
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      
      // 清理不需要的元素
      doc.querySelectorAll('script, style, nav').forEach(el => el.remove());
      
      // 转换正文内容
      const markdown = turndownService.turndown(doc.body);
      
      // 改进的标题提取逻辑
      let title = '';
      
      // 1. 首先尝试从目录中匹配
      const tocItem = toc.find(t => t.href === item.href);
      if (tocItem?.label) {
        title = tocItem.label.trim();
      }
      
      // 2. 如果没有找到目录项，尝试从文档中提取标题
      if (!title) {
        // 按优先级查找标题元素
        const titleElement = 
          doc.querySelector('h1') || 
          doc.querySelector('h2') || 
          doc.querySelector('h3') ||
          doc.querySelector('title');
        
        if (titleElement) {
          title = titleElement.textContent?.trim() || '';
        }
      }
      
      // 3. 如果还是没有标题，尝试从文件名生成标题
      if (!title) {
        const filename = item.href.split('/').pop()?.replace(/\.x?html?$/, '');
        
        // 处理 output-x-x 格式的文件名
        if (filename?.match(/^output-\d+-\d+/)) {
          // 获取第一段非空文本作为标题
          const firstParagraph = doc.evaluate(
            '//text()[normalize-space()][1]',
            doc,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;
          
          if (firstParagraph) {
            title = firstParagraph.textContent?.trim() || '';
            // 限制标题长度，取前30个字符，并在末尾添加省略号
            if (title.length > 30) {
              title = title.substring(0, 30) + '...';
            }
          }
        } 
        // 处理 part0001 格式的文件名
        else if (filename?.match(/^part\d+/)) {
          title = `第 ${parseInt(filename.replace('part', ''))} 章`;
        } else {
          title = filename || `章节 ${chapters.length + 1}`;
        }
      }
      
      // 4. 清理标题中的特殊字符和多余空白
      title = title
        .replace(/\s+/g, ' ')          // 合并多个空白字符
        .replace(/^\d+\.\s*/, '')      // 移除开头的数字和点
        .replace(/^第\s*\d+\s*章\s*/, '') // 移除"第X章"格式
        .trim();

      chapters.push({
        title: title || `章节 ${chapters.length + 1}`,
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
    const coverPath = book.package.manifest.find(item => item.properties === 'cover-image')?.href;
    if (!coverPath) return undefined;
    
    // 从ZIP包直接读取封面
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.file(coverPath);
    if (!file) return undefined;
    
    const blob = await file.async('blob');
    return URL.createObjectURL(blob);
  } catch {
    return undefined;
  }
}