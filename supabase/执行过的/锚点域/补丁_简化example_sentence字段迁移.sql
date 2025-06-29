-- 补丁：简化 example_sentence 字段迁移
-- 将 meaning_blocks 表的 example_sentence 字段移除
-- 在 meaning_block_contexts 表中添加 original_sentence 和 context_explanation 字段
-- 更新 meaning_blocks_formatted 视图逻辑

-- 1. 删除现有视图
DROP VIEW IF EXISTS public.meaning_blocks_formatted;
DROP VIEW IF EXISTS public.meaning_blocks_summary;

-- 2. 在 meaning_block_contexts 表中添加新字段
ALTER TABLE public.meaning_block_contexts 
ADD COLUMN IF NOT EXISTS original_sentence text,
ADD COLUMN IF NOT EXISTS context_explanation text;

-- 3. 从 meaning_blocks 表中删除 example_sentence 字段
ALTER TABLE public.meaning_blocks 
DROP COLUMN IF EXISTS example_sentence;

-- 4. 重新创建 meaning_blocks_formatted 视图（基于 meaning_block_contexts）
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
  mbc.context_block_id as source_context_id,
  mbc.created_at as example_created_at,
  -- 使用 ROW_NUMBER 作为例句索引
  ROW_NUMBER() OVER (PARTITION BY mb.id ORDER BY mbc.created_at) - 1 as example_index
FROM
  meaning_blocks mb
  JOIN anchors a ON mb.anchor_id = a.id
  LEFT JOIN meaning_block_contexts mbc ON mb.id = mbc.meaning_block_id;

-- 5. 重新创建 meaning_blocks_summary 视图（汇总信息）
CREATE VIEW public.meaning_blocks_summary AS
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
  -- 例句统计信息
  COUNT(mbc.id) as example_count,
  -- 第一个例句的信息（按创建时间排序）
  (SELECT context_explanation FROM meaning_block_contexts 
   WHERE meaning_block_id = mb.id 
   ORDER BY created_at LIMIT 1) as first_context_explanation,
  (SELECT original_sentence FROM meaning_block_contexts 
   WHERE meaning_block_id = mb.id 
   ORDER BY created_at LIMIT 1) as first_original_sentence,
  (SELECT context_block_id FROM meaning_block_contexts 
   WHERE meaning_block_id = mb.id 
   ORDER BY created_at LIMIT 1) as first_source_context_id
FROM
  meaning_blocks mb
  JOIN anchors a ON mb.anchor_id = a.id
  LEFT JOIN meaning_block_contexts mbc ON mb.id = mbc.meaning_block_id
GROUP BY mb.id, a.text, a.type;

-- 6. 添加视图注释
COMMENT ON VIEW public.meaning_blocks_formatted IS '含义块格式化视图 - 基于 meaning_block_contexts 表展开例句信息';
COMMENT ON VIEW public.meaning_blocks_summary IS '含义块汇总视图 - 每个含义块一行，包含例句统计信息和第一个例句的详情';

-- 7. 为新字段添加索引（可选，根据查询需求）
CREATE INDEX IF NOT EXISTS idx_meaning_block_contexts_original_sentence 
ON public.meaning_block_contexts USING btree (original_sentence);

CREATE INDEX IF NOT EXISTS idx_meaning_block_contexts_context_explanation 
ON public.meaning_block_contexts USING btree (context_explanation); 