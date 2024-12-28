export interface BookMetadata {
  title: string;
  author?: string;
  language?: string;
  publisher?: string;
  publicationDate?: string;
  coverUrl?: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  sequenceNumber: number;
}

export interface ParsedBook {
  metadata: BookMetadata;
  chapters: Chapter[];
}

export type BookFormat = 'epub' | 'mobi' | 'azw3';