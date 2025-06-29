-- 简单迁移：将 example_sentence 从单对象改为数组格式
-- 可以在 Supabase Dashboard 中直接执行

-- 1. 删除依赖的视图
DROP VIEW IF EXISTS public.meaning_blocks_formatted;

-- 2. 添加临时列
ALTER TABLE public.meaning_blocks ADD COLUMN temp_examples JSONB DEFAULT '[]'::jsonb;

-- 3. 将现有数据转换为数组格式
UPDATE public.meaning_blocks 
SET temp_examples = 
  CASE 
    WHEN example_sentence IS NOT NULL THEN 
      jsonb_build_array(example_sentence)
    ELSE 
      '[]'::jsonb
  END;

-- 4. 删除旧列
ALTER TABLE public.meaning_blocks DROP COLUMN example_sentence;

-- 5. 重命名新列
ALTER TABLE public.meaning_blocks RENAME COLUMN temp_examples TO example_sentence;

-- 6. 添加约束
ALTER TABLE public.meaning_blocks 
ADD CONSTRAINT check_example_sentence_is_array 
CHECK (jsonb_typeof(example_sentence) = 'array');

-- 7. 重新创建索引
CREATE INDEX idx_meaning_blocks_example_sentence_gin ON meaning_blocks USING gin (example_sentence);

-- 8. 重新创建支持数组格式的视图
CREATE VIEW public.meaning_blocks_formatted AS
SELECT
  mb.id,
  mb.anchor_id,
  mb.meaning,
  mb.tags,
  mb.created_at,
  mb.updated_at,
  mb.current_proficiency,
  mb.review_count,
  mb.next_review_date,
  mb.easiness_factor,
  mb.interval_days,
  mb.user_id,
  mb.example_sentence,
  a.text as anchor_text,
  a.type as anchor_type,
  extract_phonetic(mb.meaning) as phonetic,
  extract_chinese_meaning(mb.meaning) as chinese_meaning,
  -- 提取第一个例句的字段用于兼容性
  CASE 
    WHEN jsonb_array_length(mb.example_sentence) > 0 THEN
      (mb.example_sentence->0->>'context_explanation')
    ELSE NULL
  END as context_explanation,
  CASE 
    WHEN jsonb_array_length(mb.example_sentence) > 0 THEN
      (mb.example_sentence->0->>'original_sentence')
    ELSE NULL
  END as original_sentence,
  CASE 
    WHEN jsonb_array_length(mb.example_sentence) > 0 THEN
      (mb.example_sentence->0->>'source_context_id')
    ELSE NULL
  END as source_context_id
FROM
  meaning_blocks mb
  JOIN anchors a ON mb.anchor_id = a.id;

-- 9. 更新注释
COMMENT ON COLUMN public.meaning_blocks.example_sentence IS 'JSONB数组格式存储多个例句: [{"context_explanation": "上下文解释", "original_sentence": "原始完整句子", "source_context_id": "语境块ID", "created_at": "创建时间"}, ...]'; 