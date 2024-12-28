export interface Book {
  id?: string;
  title: string;
  author?: string;
  coverUrl?: string;
  chapters: Chapter[];
}

export interface Chapter {
  id?: string;
  title: string;
  content: string;
  sequenceNumber: number;
  audioSegments?: AudioSegment[];
}

export interface AudioSegment {
  id?: string;
  startTime: number;
  endTime: number;
  textContent: string;
  audioUrl?: string;
  isTts: boolean;
}