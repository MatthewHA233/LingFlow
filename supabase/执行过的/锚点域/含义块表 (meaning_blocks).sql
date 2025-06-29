-- 含义块表
CREATE TABLE public.meaning_blocks (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  anchor_id UUID NOT NULL,
  meaning TEXT NOT NULL, -- 音标 + 简洁中文含义，格式如：/məˈʃiːn/ 机器，设备
  example_sentence JSONB, -- JSON格式存储: {"context_explanation": "上下文解释", "original_sentence": "原始完整句子", "source_context_id": "语境块ID"}
  tags TEXT[], -- 标签数组，主要用于存储词性信息，如: ["noun", "countable"]
  
  -- 复习相关
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 当前状态
  current_proficiency FLOAT DEFAULT 0.0, -- 当前熟练度 0-1
  review_count INTEGER DEFAULT 0, -- 复习次数
  next_review_date TIMESTAMP WITH TIME ZONE, -- 下次复习时间
  
  -- SuperMemo 算法参数
  easiness_factor FLOAT DEFAULT 2.5, -- 难度系数
  interval_days INTEGER DEFAULT 1, -- 复习间隔天数
  
  CONSTRAINT meaning_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT meaning_blocks_anchor_id_fkey FOREIGN KEY (anchor_id) 
    REFERENCES anchors (id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_meaning_blocks_anchor_id ON meaning_blocks (anchor_id);
CREATE INDEX idx_meaning_blocks_next_review ON meaning_blocks (next_review_date);
CREATE INDEX idx_meaning_blocks_proficiency ON meaning_blocks (current_proficiency);
CREATE INDEX idx_meaning_blocks_example_sentence_gin ON meaning_blocks USING gin (example_sentence);

-- 表注释
COMMENT ON TABLE public.meaning_blocks IS '含义块表 - 存储锚点的具体含义，包括音标、中文解释、上下文信息等';
COMMENT ON COLUMN public.meaning_blocks.meaning IS '音标 + 简洁中文含义，格式如：/məˈʃiːn/ 机器，设备';
COMMENT ON COLUMN public.meaning_blocks.example_sentence IS 'JSON格式存储: {"context_explanation": "上下文解释", "original_sentence": "原始完整句子", "source_context_id": "语境块ID"}';
COMMENT ON COLUMN public.meaning_blocks.tags IS '标签数组，主要用于存储词性信息，如: ["noun", "countable"]';