import { parseEpub } from '../epub-parser';
import path from 'path';
import fs from 'fs';

describe('EPUB 解析器测试', () => {
  let testEpubFile: File;

  beforeAll(async () => {
    try {
      const epubPath = path.join(__dirname, '../__fixtures__/test.epub');
      console.log('尝试读取测试文件:', epubPath);
      
      if (!fs.existsSync(epubPath)) {
        console.error('测试文件不存在:', epubPath);
        throw new Error('测试文件不存在，请确保在 __fixtures__ 目录中放置了 test.epub 文件');
      }
      
      const buffer = await fs.promises.readFile(epubPath);
      console.log('成功读取文件，大小:', buffer.length, 'bytes');
      
      testEpubFile = new File([buffer], 'test.epub', { 
        type: 'application/epub+zip'
      });
      console.log('成功创建测试文件对象');
    } catch (error) {
      console.error('设置测试文件失败:', error);
      throw error;
    }
  });

  test('基本元数据解析', async () => {
    const book = await parseEpub(testEpubFile);
    
    // 验证基本字段存在性
    expect(book).toHaveProperty('id');
    expect(book).toHaveProperty('title');
    expect(book).toHaveProperty('author');
    expect(book).toHaveProperty('created_at');
    expect(book).toHaveProperty('updated_at');
    
    // 验证时间戳格式
    expect(new Date(book.created_at).toString()).not.toBe('Invalid Date');
    expect(new Date(book.updated_at).toString()).not.toBe('Invalid Date');
    
    // 验证ID格式（UUID）
    expect(book.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('章节内容解析', async () => {
    const book = await parseEpub(testEpubFile);
    
    // 验证章节数组
    expect(Array.isArray(book.chapters)).toBe(true);
    expect(book.chapters.length).toBeGreaterThan(0);
    
    // 验证每个章节的结构
    book.chapters.forEach(chapter => {
      expect(chapter).toHaveProperty('title');
      expect(chapter).toHaveProperty('content');
      expect(typeof chapter.title).toBe('string');
      expect(typeof chapter.content).toBe('string');
      expect(chapter.title.length).toBeGreaterThan(0);
    });
  });

  test('资源清单解析', async () => {
    const book = await parseEpub(testEpubFile);
    
    // 验证资源清单
    expect(book.resources).toBeDefined();
    if (book.resources) {
      expect(book.resources).toHaveProperty('manifest');
      expect(typeof book.resources.manifest).toBe('object');
    }
  });

  test('封面图片提取', async () => {
    const book = await parseEpub(testEpubFile);
    
    // 验证封面URL
    if (book.coverUrl) {
      expect(book.coverUrl).toMatch(/^blob:/);
    }
  });

  test('错误处理', async () => {
    // 测试无效文件类型
    const invalidTypeFile = new File(['invalid content'], 'invalid.txt', { type: 'text/plain' });
    await expect(parseEpub(invalidTypeFile)).rejects.toThrow('无效的文件类型');

    // 测试无效的EPUB内容
    const invalidContentFile = new File(['invalid content'], 'invalid.epub', { type: 'application/epub+zip' });
    await expect(parseEpub(invalidContentFile)).rejects.toThrow('无法解析电子书文件');
  }, 10000);

  test('数据结构导出', async () => {
    const book = await parseEpub(testEpubFile);
    
    // 基础信息
    console.log('\n=== 基础信息 ===');
    console.log({
      id: book.id,
      title: book.title,
      author: book.author,
      created_at: book.created_at,
      updated_at: book.updated_at
    });

    // 元数据
    console.log('\n=== 元数据 ===');
    console.log(book.metadata);

    // 目录结构
    console.log('\n=== 目录结构 ===');
    console.log(book.chapters.map(chapter => ({
      title: chapter.title,
      contentLength: chapter.content.length,
      contentPreview: chapter.content.slice(0, 100) + '...' // 只显示前100个字符
    })));

    // 资源清单
    console.log('\n=== 资源清单 ===');
    console.log(book.resources);

    // 封面信息
    console.log('\n=== 封面信息 ===');
    console.log({
      cover_url: book.cover_url,
      coverUrl: book.coverUrl
    });

    // 验证数据完整性
    expect(book).toBeDefined();
  }, 15000); // 设置更长的超时时间，因为要打印大量数据

  test('图片资源解析', async () => {
    const book = await parseEpub(testEpubFile);
    
    // 验证资源清单中的图片
    expect(book.resources).toBeDefined();
    
    const imageResources = Object.entries(book.resources?.manifest || {})
      .filter(([_, item]) => item['media-type']?.startsWith('image/'));
    
    console.log('找到图片资源数量:', imageResources.length);
    imageResources.forEach(([id, item]) => {
      console.log('图片资源详情:', {
        id,
        href: item.href,
        type: item['media-type'],
        exists: item.exists
      });
    });
    
    // 验证至少有一个图片资源
    expect(imageResources.length).toBeGreaterThan(0);
    
    // 验证图片路径格式
    imageResources.forEach(([_, item]) => {
      expect(item.href).toBeDefined();
      expect(item.href).toMatch(/^OEBPS\//);
      expect(item.exists).toBe(true);
    });
  });
}); 