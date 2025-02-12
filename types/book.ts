export interface Book {
  title: string;
  author?: string;
  chapters: {
    title: string;
    content: string;
  }[];
  coverUrl?: string;
}