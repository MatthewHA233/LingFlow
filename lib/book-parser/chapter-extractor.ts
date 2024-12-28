import { Chapter } from './types';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

export function extractChapters(content: string): Chapter[] {
  const chapters: Chapter[] = [];
  let currentChapter: Partial<Chapter> = {};
  let chapterContent: string[] = [];
  
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  const tree = processor.parse(content);
  
  visit(tree, 'heading', (node: any, index: number) => {
    if (node.depth === 1 || node.depth === 2) {
      // 保存上一章节
      if (currentChapter.title) {
        chapters.push({
          ...currentChapter as Chapter,
          content: chapterContent.join('\n\n')
        });
        chapterContent = [];
      }
      
      // 开始新章节
      currentChapter = {
        id: `chapter-${chapters.length + 1}`,
        title: node.children[0].value,
        sequenceNumber: chapters.length + 1
      };
    }
  });

  // 处理文本内容
  visit(tree, 'text', (node: any) => {
    if (currentChapter.title) {
      chapterContent.push(node.value);
    }
  });

  // 添加最后一章
  if (currentChapter.title) {
    chapters.push({
      ...currentChapter as Chapter,
      content: chapterContent.join('\n\n')
    });
  }

  return chapters;
}