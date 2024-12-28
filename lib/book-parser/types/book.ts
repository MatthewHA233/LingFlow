import { BookMetadata } from './metadata';
import { Chapter } from './chapter';

export interface ParsedBook {
  metadata: BookMetadata;
  chapters: Chapter[];
}

export type BookFormat = 'epub' | 'mobi' | 'azw3';