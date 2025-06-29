-- 补丁：更新 meaning_blocks_formatted 视图，添加 original_word_form 字段
-- 这个字段对于精确高亮显示非常重要

-- 1. 删除现有视图
DROP VIEW IF EXISTS public.meaning_blocks_formatted;

-- 2. 重新创建视图，添加 original_word_form 字段
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
  a.text as anchor_text,
  a.type as anchor_type,
  extract_phonetic(mb.meaning) as phonetic,
  extract_chinese_meaning(mb.meaning) as chinese_meaning,
  -- 从 meaning_block_contexts 表获取例句信息
  mbc.context_explanation,
  mbc.original_sentence,
  mbc.original_word_form,  -- 新增：原始词形字段
  mbc.context_block_id as source_context_id,
  mbc.created_at as example_created_at,
  mbc.start_position,      -- 新增：位置信息
  mbc.end_position,        -- 新增：位置信息
  mbc.confidence_score,    -- 新增：置信度
  -- 使用 ROW_NUMBER 作为例句索引
  ROW_NUMBER() OVER (
    PARTITION BY mb.id 
    ORDER BY mbc.created_at
  ) - 1 as example_index
FROM
  meaning_blocks mb
  JOIN anchors a ON mb.anchor_id = a.id
  LEFT JOIN meaning_block_contexts mbc ON mb.id = mbc.meaning_block_id;

-- 3. 更新视图注释
COMMENT ON VIEW public.meaning_blocks_formatted IS '含义块格式化视图 - 包含完整的语境信息和原始词形，用于精确高亮显示';

-- 4. 验证视图创建
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'meaning_blocks_formatted' 
  AND table_schema = 'public'
ORDER BY ordinal_position; 