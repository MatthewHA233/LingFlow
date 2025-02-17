import path from 'path';

interface Resource {
  href: string;
  'media-type'?: string;
  id?: string;
  oss_url?: string;
}

interface ResourceManifest {
  [key: string]: Resource;
}

interface BookResource {
  original_path: string;
  oss_path: string;
}

// 标准化路径
export function normalizePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')  // 将反斜杠转换为正斜杠
    .replace(/^\/+/, '')  // 移除开头的斜杠
    .replace(/^(OEBPS\/|OPS\/)/i, '');  // 移除OEBPS或OPS前缀
}

// 从manifest中查找资源
export function findResourceInManifest(src: string, manifest: ResourceManifest): Resource | undefined {
  const normalizedSrc = normalizePath(src);
  
  // 直接匹配
  const directMatch = Object.values(manifest).find(item => 
    item.href && normalizePath(item.href) === normalizedSrc
  );
  if (directMatch) return directMatch;

  // 按文件名匹配
  const basename = path.basename(normalizedSrc);
  return Object.values(manifest).find(item => 
    item.href && path.basename(item.href) === basename
  );
}

// 标准化内容
export function standardizeContent(content: string, resources: BookResource[] = []): string {
  // 确保 resources 是数组
  if (!Array.isArray(resources)) {
    console.warn('resources 不是数组，使用空数组代替');
    resources = [];
  }

  // 创建资源映射表
  const resourceMap = new Map(
    resources.map(r => [normalizePath(r.original_path), r.oss_path])
  );

  // 处理Markdown格式的图片路径
  content = content.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    (match, alt, src) => {
      const normalizedPath = normalizePath(src);
      const ossUrl = resourceMap.get(normalizedPath);
      if (ossUrl) {
        return `![${alt}](${ossUrl})`;
      }
      console.warn('未找到图片资源:', normalizedPath);
      return match; // 如果没找到对应的资源，保持原样
    }
  );

  // 处理HTML格式的图片
  content = content.replace(
    /<div[^>]*class="book-image"[^>]*data-original-path="([^"]*)"[^>]*>.*?<\/div>/g,
    (match, originalPath) => {
      const normalizedPath = normalizePath(originalPath);
      const ossUrl = resourceMap.get(normalizedPath);
      if (ossUrl) {
        return `![${normalizedPath}](${ossUrl})`;
      }
      console.warn('未找到图片资源:', normalizedPath);
      return match;
    }
  );

  // 移除多余的HTML标签，但保留基本格式
  content = content
    .replace(/<\/?div[^>]*>/g, '')  // 移除div标签
    .replace(/<br\s*\/?>/g, '\n')   // 将br转换为换行
    .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n')  // 保留段落的文本内容
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/g, (_, level, text) => {
      // 将标题转换为Markdown格式
      return '#'.repeat(parseInt(level)) + ' ' + text + '\n\n';
    })
    .replace(/<[^>]+>/g, '');  // 移除其他HTML标签

  // 清理多余的空行
  content = content
    .replace(/\n{3,}/g, '\n\n')  // 将3个以上的换行符替换为2个
    .trim();  // 移除首尾空白

  return content;
}

// 获取MIME类型
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// 处理章节内容
export function processChapterContent(
  content: string,
  resources: BookResource[] = []
): {
  content: string;
} {
  return {
    content: standardizeContent(content, resources)
  };
} 