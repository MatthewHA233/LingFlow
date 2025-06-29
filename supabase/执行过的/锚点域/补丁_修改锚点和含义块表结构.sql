-- 锚点和含义块表结构修改补丁
-- 执行日期: 需要在现有表基础上运行

-- 1. 修改锚点表 - 删除 normalized_text 字段
ALTER TABLE public.anchors DROP COLUMN IF EXISTS normalized_text;

-- 删除相关的唯一约束（如果存在）
ALTER TABLE public.anchors DROP CONSTRAINT IF EXISTS anchors_text_language_unique;

-- 重新创建基于 text 字段的唯一约束
ALTER TABLE public.anchors ADD CONSTRAINT anchors_text_language_unique UNIQUE (text, language);

-- 删除 normalized_text 字段的索引
DROP INDEX IF EXISTS idx_anchors_normalized;

-- 2. 创建辅助函数用于提取音标和含义（在修改表结构前创建）
CREATE OR REPLACE FUNCTION extract_phonetic(meaning_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- 提取音标部分 (假设格式为 /音标/ 含义)
  RETURN substring(meaning_text FROM '/([^/]+)/');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION extract_chinese_meaning(meaning_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- 提取中文含义部分 (音标后的部分)
  RETURN trim(substring(meaning_text FROM '/[^/]+/\s*(.*)'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. 修改含义块表字段注释和结构
-- 更新 meaning 字段注释
COMMENT ON COLUMN public.meaning_blocks.meaning IS '音标 + 简洁中文含义，格式如：/məˈʃiːn/ 机器，设备';

-- 更新 example_sentence 字段为 JSONB 类型并添加注释
-- 首先删除可能依赖此字段的视图
DROP VIEW IF EXISTS meaning_blocks_formatted;

-- 备份现有数据到临时字段
ALTER TABLE public.meaning_blocks ADD COLUMN temp_example_sentence TEXT;
UPDATE public.meaning_blocks SET temp_example_sentence = example_sentence WHERE example_sentence IS NOT NULL;

-- 删除原字段并重新创建为 JSONB
ALTER TABLE public.meaning_blocks DROP COLUMN example_sentence CASCADE;
ALTER TABLE public.meaning_blocks ADD COLUMN example_sentence JSONB;

-- 添加字段注释
COMMENT ON COLUMN public.meaning_blocks.example_sentence IS 'JSON格式存储: {"context_explanation": "上下文解释", "original_sentence": "原始完整句子", "source_context_id": "语境块ID"}';

-- 迁移现有数据到新格式
UPDATE public.meaning_blocks 
SET example_sentence = jsonb_build_object(
  'context_explanation', temp_example_sentence,
  'original_sentence', temp_example_sentence,
  'source_context_id', null
)
WHERE temp_example_sentence IS NOT NULL;

-- 删除临时字段
ALTER TABLE public.meaning_blocks DROP COLUMN temp_example_sentence;

-- 4. 更新 tags 字段注释
COMMENT ON COLUMN public.meaning_blocks.tags IS '标签数组，主要用于存储词性信息，如: ["noun", "countable"]';

-- 5. 为新的 example_sentence JSONB 字段创建索引
CREATE INDEX idx_meaning_blocks_example_sentence_gin ON meaning_blocks USING gin (example_sentence);

-- 6. 重新创建格式化视图（现在字段结构已经修改完成）
CREATE OR REPLACE VIEW meaning_blocks_formatted AS
SELECT 
  mb.*,
  a.text as anchor_text,
  a.type as anchor_type,
  extract_phonetic(mb.meaning) as phonetic,
  extract_chinese_meaning(mb.meaning) as chinese_meaning,
  (mb.example_sentence->>'context_explanation') as context_explanation,
  (mb.example_sentence->>'original_sentence') as original_sentence,
  (mb.example_sentence->>'source_context_id') as source_context_id
FROM meaning_blocks mb
JOIN anchors a ON mb.anchor_id = a.id;

-- 7. 更新表注释
COMMENT ON TABLE public.anchors IS '锚点表 - 存储词汇的原型形式，支持单词和词组';
COMMENT ON TABLE public.meaning_blocks IS '含义块表 - 存储锚点的具体含义，包括音标、中文解释、上下文信息等';

-- 8. 验证查询示例
-- 插入示例数据用于测试新格式
-- INSERT INTO anchors (text, type, language) VALUES ('machine', 'word', 'en') ON CONFLICT DO NOTHING;
-- INSERT INTO meaning_blocks (anchor_id, meaning, example_sentence, tags) 
-- SELECT 
--   a.id,
--   '/məˈʃiːn/ 机器，设备',
--   '{"context_explanation": "在工业生产中使用的设备", "original_sentence": "这台机器运行得很好。", "source_context_id": "context-123"}',
--   ARRAY['noun', 'countable']
-- FROM anchors a WHERE a.text = 'machine'; 