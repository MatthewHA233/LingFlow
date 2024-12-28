import { Chapter, ChapterExtractor } from '../types/chapter';
import { BookParserError } from '../errors/parser-error';
import { convertHtmlToMarkdown } from '../utils/html-to-markdown';
import { extractChaptersFromMarkdown } from '../utils/markdown-processor';

export class EpubChapterExtractor implements ChapterExtractor {
  constructor(private book: any) {}

  async extractChapters(): Promise<Chapter[]> {
    try {
      const spine = await this.book.loaded.spine;
      const chapters: Chapter[] = [];

      for (const item of spine.spineItems) {
        const content = await item.load();
        if (!content?.content) {
          throw new BookParserError(`无法加载章节内容: ${item.href}`);
        }

        const markdown = convertHtmlToMarkdown(content.content);
        const extractedChapters = extractChaptersFromMarkdown(markdown);
        chapters.push(...extractedChapters);
      }

      return chapters;
    } catch (error) {
      throw new BookParserError('提取章节失败', error);
    }
  }
}