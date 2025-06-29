-- 锚点类型枚举
CREATE TYPE anchor_type AS ENUM ('word', 'phrase', 'compound');

-- 锚点表
CREATE TABLE public.anchors (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  text TEXT NOT NULL, -- 锚点文本，存储词汇原型形式，支持单词和词组
  type anchor_type NOT NULL DEFAULT 'word',
  language TEXT DEFAULT 'en', -- 语言标识，默认英语
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 统计信息
  total_contexts INTEGER DEFAULT 0, -- 总出现次数
  total_meaning_blocks INTEGER DEFAULT 0, -- 含义块数量
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT anchors_pkey PRIMARY KEY (id),
  CONSTRAINT anchors_text_language_unique UNIQUE (text, language)
);

-- 索引
CREATE INDEX idx_anchors_text ON anchors USING btree (text);
CREATE INDEX idx_anchors_type ON anchors USING btree (type);

-- 表注释
COMMENT ON TABLE public.anchors IS '锚点表 - 存储词汇的原型形式，支持单词和词组';
COMMENT ON COLUMN public.anchors.text IS '词汇原型形式，无需标准化处理';
COMMENT ON COLUMN public.anchors.type IS '锚点类型：word(单词), phrase(短语), compound(复合词)';
COMMENT ON COLUMN public.anchors.language IS '语言标识，默认为英语(en)';