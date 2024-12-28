import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { Chapter } from '../types/chapter';

export function extractChaptersFromMarkdown(markdown: string): Chapter[] {
  const chapters: Chapter[] = [];
  let currentChapter: Partial<Chapter> = {};
  let chapterContent: string[] = [];
  
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  const tree = processor.parse(markdown);
  
  visit(tree, 'heading', (node: any, index: number) => {
    if (node.depth === 1 || node.depth === 2) {
      // Save previous chapter if exists
      if (currentChapter.title) {
        chapters.push({
          ...currentChapter as Chapter,
          content: chapterContent.join('\n\n')
        });
        chapterContent = [];
      }
      
      // Start new chapter
      currentChapter = {
        id: `chapter-${chapters.length + 1}`,
        title: node.children[0].value,
        sequenceNumber: chapters.length + 1
      };
    }
  });

  // Process text content
  visit(tree, 'text', (node: any) => {
    if (currentChapter.title) {
      chapterContent.push(node.value);
    }
  });

  // Add the last chapter
  if (currentChapter.title) {
    chapters.push({
      ...currentChapter as Chapter,
      content: chapterContent.join('\n\n')
    });
  }

  // If no chapters were found, create a single chapter from the content
  if (chapters.length === 0) {
    chapters.push({
      id: 'chapter-1',
      title: '第一章',
      content: markdown,
      sequenceNumber: 1
    });
  }

  return chapters;
}