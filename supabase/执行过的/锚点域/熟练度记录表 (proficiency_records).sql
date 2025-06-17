-- 熟练度记录表
CREATE TABLE public.proficiency_records (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  meaning_block_id UUID NOT NULL,
  
  -- 复习记录
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  proficiency_before FLOAT NOT NULL, -- 复习前熟练度
  proficiency_after FLOAT NOT NULL, -- 复习后熟练度
  
  -- 复习质量评分 (0-5, 参考SuperMemo)
  quality_score INTEGER NOT NULL CHECK (quality_score >= 0 AND quality_score <= 5),
  
  -- 复习时间
  review_duration_seconds INTEGER, -- 复习用时
  
  CONSTRAINT proficiency_records_pkey PRIMARY KEY (id),
  CONSTRAINT proficiency_records_meaning_block_id_fkey FOREIGN KEY (meaning_block_id) 
    REFERENCES meaning_blocks (id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_proficiency_records_meaning_block ON proficiency_records (meaning_block_id);
CREATE INDEX idx_proficiency_records_reviewed_at ON proficiency_records (reviewed_at);