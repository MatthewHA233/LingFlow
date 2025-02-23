// 首先定义一些类型
export interface MeaningBlock {
  id: string;
  meaning: string;
  contexts: {
    text: string;
    source: string;
    date: string;
  }[];
  reviewCount: number;
  nextReviewDate?: string;
  proficiency: number; // 0-100 的熟练度
}

export interface Anchor {
  word: string;
  contexts?: string[];
  meaningBlocks: MeaningBlock[];
  totalContexts: number;
  lastUpdated: string;
}

export interface TimeDomain {
  id: string;
  month: string; // 例如: "2024-02"
  days: {
    date: string; // 例如: "2024-02-19"
    anchors: Anchor[];
  }[];
  totalAnchors: number;
  meaningBlocks: number;
}

export interface SpaceDomain {
  id: string;
  title: string;
  description: string;
  type: string;
  anchors: Anchor[];
  totalAnchors: number;
  meaningBlocks: number;
} 