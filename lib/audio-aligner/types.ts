export interface GentleResponse {
  transcript: string;
  words: AlignedWord[];
}

export interface AlignedWord {
  word: string;
  start: number;
  end: number;
  aligned: boolean;
}

export interface AudioAlignment {
  id?: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
}