// 锚点系统的类型定义

export interface MeaningBlock {
  id: string;
  anchor_id: string;
  meaning: string;
  tags: string[];
  
  // 基础状态
  current_proficiency: number; // 0-1
  review_count: number;
  next_review_date?: string;
  
  // SuperMemo参数（保留但不使用）
  easiness_factor: number;
  interval_days: number;
  
  // 关联的语境块
  contexts: MeaningBlockContext[];
  
  // 移除复习历史
  proficiency_records: any[];
  
  // 添加创建时间用于高亮
  created_at: string;
}

export interface Anchor {
  id: string;
  text: string;
  type: 'word' | 'phrase' | 'compound';
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
  original_sentence?: string;
  context_explanation?: string;
  original_word_form?: string; // 语境下的原始单词形态，如 "running"、"cats"、"better" 等
  
  // 关联的语境块信息
  context_block?: {
    id: string;
    content: string;
    block_type: string;
    created_at: string;
  };
}

// 移除复习相关的接口
// export interface ProficiencyRecord
// export interface ReviewSession
// export interface ReviewQueue 