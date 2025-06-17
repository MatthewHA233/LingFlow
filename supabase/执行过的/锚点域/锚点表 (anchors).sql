-- 锚点类型枚举
CREATE TYPE anchor_type AS ENUM ('word', 'phrase', 'compound');

-- 锚点表
CREATE TABLE public.anchors (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  text TEXT NOT NULL, -- 锚点文本，支持单词和词组
  type anchor_type NOT NULL DEFAULT 'word',
  normalized_text TEXT NOT NULL, -- 标准化文本（小写、去空格等）
  language TEXT DEFAULT 'zh', -- 语言标识
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 统计信息
  total_contexts INTEGER DEFAULT 0, -- 总出现次数
  total_meaning_blocks INTEGER DEFAULT 0, -- 含义块数量
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT anchors_pkey PRIMARY KEY (id),
  CONSTRAINT anchors_text_language_unique UNIQUE (normalized_text, language)
);

-- 索引
CREATE INDEX idx_anchors_text ON anchors USING btree (text);
CREATE INDEX idx_anchors_normalized ON anchors USING btree (normalized_text);
CREATE INDEX idx_anchors_type ON anchors USING btree (type);