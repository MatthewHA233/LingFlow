export interface Chapter {
  id: string;
  title: string;
  content: string;
  sequenceNumber: number;
}

export interface ChapterExtractor {
  extractChapters(): Promise<Chapter[]>;
}