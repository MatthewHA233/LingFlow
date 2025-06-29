-- 修改视图：将 example_sentence 数组展开为多行
-- 每个例句对应一行记录，类似 meaning_block_contexts 的结构

-- 1. 删除现有视图
DROP VIEW IF EXISTS public.meaning_blocks_formatted;

-- 2. 创建新的展开式视图
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
  -- 例句相关字段（展开的）
  (example_item.value->>'context_explanation') as context_explanation,
  (example_item.value->>'original_sentence') as original_sentence,
  (example_item.value->>'source_context_id') as source_context_id,
  (example_item.value->>'created_at') as example_created_at,
  -- 例句在数组中的索引（从0开始）
  (example_item.ordinality - 1) as example_index
FROM
  meaning_blocks mb
  JOIN anchors a ON mb.anchor_id = a.id
  -- 使用 jsonb_array_elements_text 展开数组，with ordinality 提供索引
  LEFT JOIN LATERAL jsonb_array_elements(mb.example_sentence) WITH ORDINALITY AS example_item(value, ordinality) ON true;

-- 3. 为没有例句的含义块创建兼容视图
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
  jsonb_array_length(COALESCE(mb.example_sentence, '[]'::jsonb)) as example_count,
  -- 第一个例句的信息（向后兼容）
  CASE 
    WHEN jsonb_array_length(COALESCE(mb.example_sentence, '[]'::jsonb)) > 0 THEN
      (mb.example_sentence->0->>'context_explanation')
    ELSE NULL
  END as first_context_explanation,
  CASE 
    WHEN jsonb_array_length(COALESCE(mb.example_sentence, '[]'::jsonb)) > 0 THEN
      (mb.example_sentence->0->>'original_sentence')
    ELSE NULL
  END as first_original_sentence,
  CASE 
    WHEN jsonb_array_length(COALESCE(mb.example_sentence, '[]'::jsonb)) > 0 THEN
      (mb.example_sentence->0->>'source_context_id')
    ELSE NULL
  END as first_source_context_id
FROM
  meaning_blocks mb
  JOIN anchors a ON mb.anchor_id = a.id;

-- 4. 添加视图注释
COMMENT ON VIEW public.meaning_blocks_formatted IS '含义块格式化视图 - 将example_sentence数组展开为多行，每个例句对应一行记录';
COMMENT ON VIEW public.meaning_blocks_summary IS '含义块汇总视图 - 每个含义块一行，包含例句统计信息和第一个例句的详情（向后兼容）'; 