import * as epubjs from 'epubjs';
import { ParsedBook } from './types/book';
import { EpubMetadataExtractor } from './epub/metadata-extractor';
import { EpubChapterExtractor } from './epub/chapter-extractor';
import { BookParserError } from './errors/parser-error';

export async function parseEpub(file: File): Promise<ParsedBook> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const book = epubjs(arrayBuffer);
    await book.ready;

    const metadataExtractor = new EpubMetadataExtractor(book);
    const chapterExtractor = new EpubChapterExtractor(book);

    const [metadata, chapters] = await Promise.all([
      metadataExtractor.extractMetadata(),
      chapterExtractor.extractChapters()
    ]);

    return { metadata, chapters };
  } catch (error) {
    throw BookParserError.fromError(
      error,
      '无法解析电子书文件，请确保文件格式正确'
    );
  }
}