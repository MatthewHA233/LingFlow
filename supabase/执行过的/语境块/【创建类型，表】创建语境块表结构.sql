/*
文件说明：创建语境块（Context Block）的数据表结构

主要功能：
1. 定义语境块类型枚举
2. 创建语境块表，支持多种类型的内容块
3. 建立灵活的父子关系
4. 优化查询性能的索引结构

特点：
- 模块化设计，支持不同类型的内容块
- 灵活的父级关联关系（章节、视频、自定义页面等）
- 完整的层级关系管理
- 支持音频文本对齐
*/

-- 创建内容类型枚举
CREATE TYPE content_type AS ENUM (
  'chapter',        -- 书籍章节
  'video',          -- 视频内容
  'custom_page',    -- 自定义页面
  'collection'      -- 内容集合
);

-- 创建语境块类型枚举
CREATE TYPE block_type AS ENUM (
  'text',           -- 普通文本段落
  'heading_1',      -- 一级标题
  'heading_2',      -- 二级标题
  'heading_3',      -- 三级标题
  'heading_4',      -- 四级标题
  'heading_5',      -- 五级标题
  'heading_6',      -- 六级标题
  'image',          -- 图片
  'audio_aligned',  -- 音频对齐文本
  'video_aligned'   -- 视频对齐文本
);

-- 创建内容父级表（用于统一管理不同类型的内容）
CREATE TABLE IF NOT EXISTS content_parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_type content_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建语境块表
CREATE TABLE IF NOT EXISTS context_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES content_parents(id) ON DELETE CASCADE,
  block_type block_type NOT NULL,
  content TEXT,                    -- 文本内容或媒体URL
  order_index INTEGER NOT NULL,    -- 在父级内容中的顺序
  metadata JSONB DEFAULT '{}'::jsonb,  -- 额外元数据（如媒体尺寸、样式等）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 音频/视频对齐相关字段
  speech_id UUID REFERENCES speech_results(id),  -- 关联的语音识别结果
  begin_time INTEGER,              -- 媒体开始时间（毫秒）
  end_time INTEGER,               -- 媒体结束时间（毫秒）
  
  -- 确保每个父级内容中的块顺序唯一
  UNIQUE(parent_id, order_index)
);

-- 创建音频对齐块与句子的关联表
CREATE TABLE IF NOT EXISTS block_sentences (
  block_id UUID REFERENCES context_blocks(id) ON DELETE CASCADE,
  sentence_id UUID REFERENCES sentences(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,    -- 句子在块中的顺序
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (block_id, sentence_id),
  UNIQUE(block_id, order_index)
);

-- 创建章节与父级内容的关联
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES content_parents(id);
UPDATE chapters SET parent_id = (
  SELECT id FROM content_parents 
  WHERE content_type = 'chapter' 
  AND content_parents.user_id = (
    SELECT user_id FROM books WHERE books.id = chapters.book_id
  )
  LIMIT 1
);

-- 创建索引
CREATE INDEX idx_content_parents_type ON content_parents(content_type);
CREATE INDEX idx_content_parents_user_id ON content_parents(user_id);
CREATE INDEX idx_context_blocks_parent_id ON context_blocks(parent_id);
CREATE INDEX idx_context_blocks_speech_id ON context_blocks(speech_id);
CREATE INDEX idx_context_blocks_type ON context_blocks(block_type);
CREATE INDEX idx_context_blocks_order ON context_blocks(order_index);
CREATE INDEX idx_block_sentences_block_id ON block_sentences(block_id);
CREATE INDEX idx_block_sentences_sentence_id ON block_sentences(sentence_id);
CREATE INDEX idx_block_sentences_order ON block_sentences(order_index);

-- 创建更新时间戳触发器
CREATE TRIGGER update_content_parents_updated_at
  BEFORE UPDATE ON content_parents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_context_blocks_updated_at
  BEFORE UPDATE ON context_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 设置行级安全策略
ALTER TABLE content_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_sentences ENABLE ROW LEVEL SECURITY;

-- 用户可以访问自己的内容父级
CREATE POLICY "用户访问自己的内容父级"
ON content_parents FOR ALL
USING (user_id = auth.uid());

-- 用户可以访问自己的语境块
CREATE POLICY "用户访问自己的语境块"
ON context_blocks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM content_parents
    WHERE id = context_blocks.parent_id
    AND user_id = auth.uid()
  )
);

-- 用户可以访问自己的块句子关联
CREATE POLICY "用户访问自己的块句子关联"
ON block_sentences FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM context_blocks
    JOIN content_parents ON content_parents.id = context_blocks.parent_id
    WHERE context_blocks.id = block_sentences.block_id
    AND content_parents.user_id = auth.uid()
  )
);

-- 创建辅助视图：带完整内容的语境块视图
CREATE VIEW context_blocks_full AS
SELECT 
  cb.*,
  cp.content_type,
  cp.title as parent_title,
  CASE 
    WHEN cb.block_type IN ('audio_aligned', 'video_aligned') THEN (
      SELECT json_agg(
        json_build_object(
          'sentence_id', s.id,
          'text_content', s.text_content,
          'begin_time', s.begin_time,
          'end_time', s.end_time,
          'order_index', bs.order_index
        ) ORDER BY bs.order_index
      )
      FROM block_sentences bs
      JOIN sentences s ON s.id = bs.sentence_id
      WHERE bs.block_id = cb.id
    )
    ELSE NULL
  END as aligned_sentences
FROM context_blocks cb
JOIN content_parents cp ON cp.id = cb.parent_id; 