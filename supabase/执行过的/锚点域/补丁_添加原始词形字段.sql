-- 为含义块与语境块关联表添加原始词形字段
-- 执行日期: 需要在现有表基础上运行

-- 1. 为 meaning_block_contexts 表添加新字段
ALTER TABLE public.meaning_block_contexts 
ADD COLUMN original_word_form TEXT; -- 存储语境下的原始单词形态（非原型）

-- 2. 添加字段注释
COMMENT ON COLUMN public.meaning_block_contexts.original_word_form IS '语境下的原始单词形态，如 "running"、"cats"、"better" 等非原型形式';

-- 3. 更新表注释
COMMENT ON TABLE public.meaning_block_contexts IS '含义块与语境块关联表 - 记录含义块在特定语境中的出现位置和原始形态';

-- 4. 创建复合索引以支持高效查询
CREATE INDEX idx_meaning_block_contexts_word_position ON meaning_block_contexts (original_word_form, start_position, end_position);

-- 5. 验证查询示例
-- SELECT 
--   mbc.original_word_form,
--   mbc.start_position,
--   mbc.end_position,
--   mb.meaning,
--   a.text as lemma
-- FROM meaning_block_contexts mbc
-- JOIN meaning_blocks mb ON mbc.meaning_block_id = mb.id
-- JOIN anchors a ON mb.anchor_id = a.id
-- WHERE mbc.context_block_id = 'some-context-id'; 