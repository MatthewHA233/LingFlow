export interface Book {
  id: string;
  title: string;
  author: string;
  cover_url: string;
  description?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  epub_path: string;
  audio_path: string;
  progress?: number;
  last_position?: string;
  metadata?: {
    language?: string;
    publisher?: string;
    published_date?: string;
    isbn?: string;
  };
  chapters?: Array<{
    title: string;
    content: string;
  }>;
}

export interface BookProgress {
  book_id: string;
  user_id: string;
  progress: number;
  last_position: string;
  updated_at: string;
}