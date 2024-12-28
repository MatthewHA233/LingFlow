export interface BookMetadata {
  title: string;
  author?: string;
  language?: string;
  publisher?: string;
  publicationDate?: string;
  coverUrl?: string;
}

export interface MetadataExtractor {
  extractMetadata(): Promise<BookMetadata>;
}