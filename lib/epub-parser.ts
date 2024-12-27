import ePub from 'epubjs';
import { Book } from '@/types/book';

export async function parseEpub(file: File): Promise<Book> {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const book = ePub(arrayBuffer);
    await book.ready;

    const [metadata, cover, chapters] = await Promise.all([
      book.loaded.metadata,
      book.coverUrl(),
      getChapters(book)
    ]);

    return {
      title: metadata.title || '未知标题',
      author: metadata.creator || '未知作者',
      content: chapters,
      coverUrl: cover || undefined
    };
  } catch (error) {
    console.error('解析 EPUB 文件失败:', error);
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

async function getChapters(book: any): Promise<string> {
  const spine = await book.loaded.spine;
  const chapters = await Promise.all(
    spine.spineItems.map(async (item: any) => {
      try {
        const doc = await item.load();
        return doc.content || '';
      } catch (error) {
        console.warn(`加载章节失败: ${error}`);
        return '';
      }
    })
  );
  
  return chapters.filter(Boolean).join('\n\n');
}