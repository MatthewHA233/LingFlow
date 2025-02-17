import { useCallback } from 'react';
import JSZip from 'jszip';
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

export function useBookImageProcessor(arrayBuffer: ArrayBuffer, resources?: { manifest: ResourceManifest }) {
  const processContent = useCallback(async (content: string): Promise<string> => {
    const blobUrls: string[] = [];
    try {
      console.log('开始处理章节内容中的图片');
      const zip = await JSZip.loadAsync(arrayBuffer);
      const manifest = resources?.manifest || {};
      
      console.log('资源清单:', manifest);
      console.log('ZIP文件列表:', Object.keys(zip.files));

      // 创建路径映射表
      const pathMapping = Object.values(manifest).reduce((acc: Record<string, string>, item: Resource) => {
        if (item.href) {
          const normalized = item.href
            .replace(/\\/g, '/')
            .replace(/^\//, '')
            .toLowerCase();
          acc[normalized] = item.href;
          acc[path.basename(normalized)] = item.href;
        }
        return acc;
      }, {});

      // 首先处理HTML格式的图片标签
      content = content.replace(
        /<div class="book-image"[^>]*data-original-path="([^"]*)">\s*!\[\]\(([^)]+)\)\s*<\/div>/g,
        (_, originalPath, url) => {
          console.log('处理HTML图片标签:', { originalPath, url });
          return `![${originalPath}](${url})`;
        }
      );
      
      // 然后处理Markdown格式的图片
      const resolvedContent = await Promise.all(
        content.split('\n').map(async (line) => {
          if (!line.includes('![')) return line;
          
          console.log('处理包含图片的行:', line);
          
          return await Promise.all(
            line.split(/(!?\[.*?\]\(.*?\))/).map(async (part) => {
              if (!part.match(/!\[.*?\]\(.*?\)/)) return part;
              
              const [, alt = '', src = ''] = part.match(/!\[(.*?)\]\((.*?)\)/) || [];
              const normalizedSrc = src.replace(/\\/g, '/').replace(/^\//, '').toLowerCase();
              
              console.log('处理图片标记:', {
                original: part,
                alt,
                src,
                normalizedSrc
              });

              // 如果已经是OSS URL，直接返回
              if (src.includes('oss-cn-beijing.aliyuncs.com')) {
                return `![${alt}](${src})`;
              }

              // 首先检查是否有对应的 OSS URL
              const resourceEntry = Object.entries(manifest).find(([_, item]) => {
                const itemPath = item.href?.replace(/\\/g, '/').replace(/^\//, '').toLowerCase();
                return itemPath === normalizedSrc;
              });

              if (resourceEntry && resourceEntry[1].oss_url) {
                console.log('使用 OSS URL:', resourceEntry[1].oss_url);
                return `![${alt}](${resourceEntry[1].oss_url})`;
              }

              // 如果没有 OSS URL，尝试从 ZIP 中获取
              // 尝试多种路径组合
              const possiblePaths = [
                src,
                normalizedSrc,
                `OEBPS/${src}`,
                `OPS/${src}`,
                pathMapping[normalizedSrc],
                ...Object.keys(zip.files).filter(filePath => {
                  const fileBaseName = path.basename(filePath).toLowerCase();
                  const srcBaseName = path.basename(normalizedSrc).toLowerCase();
                  return fileBaseName === srcBaseName;
                })
              ].filter(Boolean);

              console.log('尝试的路径组合:', possiblePaths);

              // 尝试找到图片文件
              let imageFile = null;
              let foundPath = '';
              for (const testPath of possiblePaths) {
                imageFile = zip.file(testPath);
                if (imageFile) {
                  foundPath = testPath;
                  console.log(`找到图片文件: ${testPath}`);
                  break;
                }
              }

              if (!imageFile) {
                // 尝试在manifest中查找
                const manifestEntry = Object.values(manifest).find(item => {
                  if (!item.href) return false;
                  const itemPath = item.href.replace(/\\/g, '/').replace(/^\//, '').toLowerCase();
                  return itemPath.endsWith(path.basename(normalizedSrc));
                });

                if (manifestEntry?.href) {
                  imageFile = zip.file(manifestEntry.href);
                  if (imageFile) {
                    foundPath = manifestEntry.href;
                    console.log(`通过manifest找到图片文件: ${foundPath}`);
                  }
                }

                if (!imageFile) {
                  console.warn(`未找到图片文件: ${src}，尝试的路径:`, possiblePaths);
                  return part;
                }
              }

              try {
                const blob = await imageFile.async('blob');
                const blobUrl = URL.createObjectURL(blob);
                blobUrls.push(blobUrl);
                console.log('成功创建图片Blob URL:', {
                  original: src,
                  blobUrl,
                  size: blob.size
                });
                return `![${alt}](${blobUrl})`;
              } catch (error) {
                console.error(`处理图片失败: ${src}`, error);
                return part;
              }
            })
          ).then(parts => parts.join(''));
        })
      ).then(lines => lines.join('\n'));

      return resolvedContent;
    } catch (error) {
      console.error('处理图片路径失败:', error);
      return content;
    }
  }, [arrayBuffer, resources?.manifest]);

  const cleanupBlobUrls = useCallback(() => {
    const images = document.querySelectorAll('.prose img[src^="blob:"]');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src) URL.revokeObjectURL(src);
    });
  }, []);

  return {
    processContent,
    cleanupBlobUrls
  };
} 