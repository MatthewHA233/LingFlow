// 首先定义一些类型
export interface MeaningBlock {
  id: string;
  anchor_id: string;
  meaning: string;
  example_sentence?: string;
  tags: string[];
  
  // 复习状态
  current_proficiency: number; // 0-1
  review_count: number;
  next_review_date?: string;
  
  // SuperMemo参数
  easiness_factor: number;
  interval_days: number;
  
  // 关联的语境块
  contexts: MeaningBlockContext[];
  
  // 复习历史
  proficiency_records: ProficiencyRecord[];
}

export interface Anchor {
  id: string;
  text: string;
  type: 'word' | 'phrase' | 'compound';
  normalized_text: string;
  language: string;
  total_contexts: number;
  total_meaning_blocks: number;
  last_reviewed_at?: string;
  created_at: string;
  updated_at: string;
  meaning_blocks: MeaningBlock[];
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

export interface MeaningBlockContext {
  id: string;
  context_block_id: string;
  start_position?: number;
  end_position?: number;
  confidence_score: number;
  
  // 关联的语境块信息
  context_block?: {
    id: string;
    content: string;
    block_type: string;
    created_at: string;
  };
}

export interface ProficiencyRecord {
  id: string;
  reviewed_at: string;
  proficiency_before: number;
  proficiency_after: number;
  quality_score: number; // 0-5
  review_duration_seconds?: number;
}

// 复习相关
export interface ReviewSession {
  meaning_block_id: string;
  quality_score: number;
  review_duration_seconds?: number;
}

export interface ReviewQueue {
  due_today: MeaningBlock[];
  overdue: MeaningBlock[];
  upcoming: MeaningBlock[];
} 