-- 含义块与语境块关联表
CREATE TABLE public.meaning_block_contexts (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  meaning_block_id UUID NOT NULL,
  context_block_id UUID NOT NULL,
  
  -- 在语境块中的位置信息
  start_position INTEGER, -- 开始位置
  end_position INTEGER, -- 结束位置
  
  -- 关联信息
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confidence_score FLOAT DEFAULT 1.0, -- 关联置信度
  
  CONSTRAINT meaning_block_contexts_pkey PRIMARY KEY (id),
  CONSTRAINT meaning_block_contexts_meaning_block_id_fkey FOREIGN KEY (meaning_block_id) 
    REFERENCES meaning_blocks (id) ON DELETE CASCADE,
  CONSTRAINT meaning_block_contexts_context_block_id_fkey FOREIGN KEY (context_block_id) 
    REFERENCES context_blocks (id) ON DELETE CASCADE,
  CONSTRAINT meaning_block_contexts_unique UNIQUE (meaning_block_id, context_block_id)
);

-- 索引
CREATE INDEX idx_meaning_block_contexts_meaning_block ON meaning_block_contexts (meaning_block_id);
CREATE INDEX idx_meaning_block_contexts_context_block ON meaning_block_contexts (context_block_id);