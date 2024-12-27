export interface Char {
  value: string;
  x: number;
  y: number;
  speed: number;
}

export interface Stream {
  chars: Char[];
}

export interface MatrixConfig {
  charSize: number;
  fallRate: number;
  languages: string[];
}