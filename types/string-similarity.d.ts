declare module 'string-similarity' {
  export interface BestMatch {
    ratings: Array<{
      target: string;
      rating: number;
    }>;
    bestMatch: {
      target: string;
      rating: number;
    };
    bestMatchIndex: number;
  }

  export function findBestMatch(mainString: string, targetStrings: string[]): BestMatch;
  export function compareTwoStrings(first: string, second: string): number;
} 