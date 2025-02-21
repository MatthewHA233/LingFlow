/*
文件说明：创建语境块转换和对齐的数据结构

主要功能：
1. 扩展语境块表，支持转换状态追踪
2. 创建转换过程记录表
3. 创建文本对齐记录表
4. 创建相关触发器和函数

使用场景：
- 文本块转换为音频对齐块
- 追踪转换进度
- 记录文本对齐结果
- 支持转换回退操作
*/

-- 创建转换状态枚举
CREATE TYPE conversion_status AS ENUM (
  'none',        -- 未开始转换
  'converting',  -- 转换中
  'converted',   -- 已转换
  'failed',      -- 转换失败
  'reverted'     -- 已回退
);

-- 扩展语境块表，添加转换相关字段
ALTER TABLE context_blocks 
ADD COLUMN IF NOT EXISTS original_content TEXT,
ADD COLUMN IF NOT EXISTS conversion_status conversion_status DEFAULT 'none',
ADD COLUMN IF NOT EXISTS conversion_metadata JSONB DEFAULT '{}'::jsonb;

-- 创建转换过程追踪表
CREATE TABLE IF NOT EXISTS block_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_id UUID REFERENCES context_blocks(id) ON DELETE CASCADE,
  from_type block_type NOT NULL,
  to_type block_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' 
    CHECK (status IN ('processing', 'completed', 'failed', 'reverted')),
  progress INTEGER DEFAULT 0 
    CHECK (progress >= 0 AND progress <= 100),
  matching_data JSONB DEFAULT '{}'::jsonb,  -- 存储文本匹配的中间结果
  error_message TEXT,                       -- 存储失败原因
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,      -- 实际开始转换的时间
  completed_at TIMESTAMP WITH TIME ZONE,    -- 完成或失败的时间
  
  -- 确保block_id在最新的转换记录中是唯一的
  CONSTRAINT unique_active_conversion UNIQUE (block_id, status)
    DEFERRABLE INITIALLY DEFERRED
);

-- 创建文本对齐记录表
CREATE TABLE IF NOT EXISTS text_alignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_id UUID REFERENCES context_blocks(id) ON DELETE CASCADE,
  conversion_id UUID REFERENCES block_conversions(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  aligned_text TEXT NOT NULL,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  alignment_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 用于存储对齐的详细信息
  original_range JSONB,  -- {start: x, end: y} 在原文中的位置
  aligned_range JSONB,   -- {start: x, end: y} 在对齐文本中的位置
  manual_correction BOOLEAN DEFAULT false  -- 标记是否经过手动修正
);

-- 创建索引
CREATE INDEX idx_block_conversions_block_id ON block_conversions(block_id);
CREATE INDEX idx_block_conversions_status ON block_conversions(status);
CREATE INDEX idx_text_alignments_block_id ON text_alignments(block_id);
CREATE INDEX idx_text_alignments_conversion_id ON text_alignments(conversion_id);

-- 创建转换开始函数
CREATE OR REPLACE FUNCTION start_block_conversion(
  p_block_id UUID,
  p_to_type block_type
) RETURNS UUID AS $$
DECLARE
  v_from_type block_type;
  v_conversion_id UUID;
BEGIN
  -- 获取当前块类型
  SELECT block_type INTO v_from_type
  FROM context_blocks
  WHERE id = p_block_id;
  
  -- 创建转换记录
  INSERT INTO block_conversions (
    block_id, 
    from_type, 
    to_type, 
    status, 
    started_at
  ) VALUES (
    p_block_id,
    v_from_type,
    p_to_type,
    'processing',
    NOW()
  ) RETURNING id INTO v_conversion_id;
  
  -- 更新块状态
  UPDATE context_blocks
  SET conversion_status = 'converting',
      original_content = content
  WHERE id = p_block_id;
  
  RETURN v_conversion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建转换完成函数
CREATE OR REPLACE FUNCTION complete_block_conversion(
  p_conversion_id UUID,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_block_id UUID;
  v_to_type block_type;
BEGIN
  -- 获取转换信息
  SELECT block_id, to_type INTO v_block_id, v_to_type
  FROM block_conversions
  WHERE id = p_conversion_id;
  
  -- 更新转换记录
  UPDATE block_conversions
  SET status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
      progress = CASE WHEN p_success THEN 100 ELSE progress END,
      error_message = p_error_message,
      completed_at = NOW()
  WHERE id = p_conversion_id;
  
  -- 更新块状态
  UPDATE context_blocks
  SET conversion_status = CASE 
        WHEN p_success THEN 'converted'
        ELSE 'failed'
      END,
      block_type = CASE 
        WHEN p_success THEN v_to_type
        ELSE block_type
      END
  WHERE id = v_block_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建转换回退函数
CREATE OR REPLACE FUNCTION revert_block_conversion(
  p_block_id UUID
) RETURNS VOID AS $$
BEGIN
  -- 更新最新的转换记录为已回退
  UPDATE block_conversions
  SET status = 'reverted',
      completed_at = NOW()
  WHERE block_id = p_block_id
  AND status IN ('completed', 'failed')
  AND id = (
    SELECT id FROM block_conversions
    WHERE block_id = p_block_id
    ORDER BY created_at DESC
    LIMIT 1
  );
  
  -- 恢复块的原始状态
  UPDATE context_blocks
  SET content = original_content,
      conversion_status = 'reverted',
      block_type = (
        SELECT from_type
        FROM block_conversions
        WHERE block_id = p_block_id
        ORDER BY created_at DESC
        LIMIT 1
      )
  WHERE id = p_block_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 设置行级安全策略
ALTER TABLE block_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_alignments ENABLE ROW LEVEL SECURITY;

-- 创建访问策略
CREATE POLICY "用户访问自己的块转换记录"
ON block_conversions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM context_blocks cb
    JOIN content_parents cp ON cp.id = cb.parent_id
    WHERE cb.id = block_conversions.block_id
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "用户访问自己的文本对齐记录"
ON text_alignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM context_blocks cb
    JOIN content_parents cp ON cp.id = cb.parent_id
    WHERE cb.id = text_alignments.block_id
    AND cp.user_id = auth.uid()
  )
);

-- 创建辅助视图：转换进度视图
CREATE VIEW conversion_progress AS
SELECT 
  bc.id as conversion_id,
  bc.block_id,
  bc.from_type,
  bc.to_type,
  bc.status,
  bc.progress,
  bc.error_message,
  cb.content as current_content,
  cb.original_content,
  cb.conversion_status,
  cp.user_id,
  cp.content_type as parent_type,
  cp.title as parent_title,
  (
    SELECT json_agg(
      json_build_object(
        'id', ta.id,
        'original_text', ta.original_text,
        'aligned_text', ta.aligned_text,
        'confidence_score', ta.confidence_score,
        'manual_correction', ta.manual_correction
      ) ORDER BY ta.created_at
    )
    FROM text_alignments ta
    WHERE ta.conversion_id = bc.id
  ) as alignment_details
FROM block_conversions bc
JOIN context_blocks cb ON cb.id = bc.block_id
JOIN content_parents cp ON cp.id = cb.parent_id;
