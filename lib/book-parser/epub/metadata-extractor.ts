import { BookMetadata, MetadataExtractor } from '../types/metadata';
import { BookParserError } from '../errors/parser-error';

export class EpubMetadataExtractor implements MetadataExtractor {
  constructor(private book: any) {}

  async extractMetadata(): Promise<BookMetadata> {
    try {
      const metadata = await this.book.loaded.metadata;
      const coverUrl = await this.book.coverUrl();

      return {
        title: metadata.title || '未知标题',
        author: metadata.creator,
        language: metadata.language,
        publisher: metadata.publisher,
        publicationDate: metadata.date,
        coverUrl
      };
    } catch (error) {
      throw new BookParserError('提取元数据失败', error);
    }
  }
}