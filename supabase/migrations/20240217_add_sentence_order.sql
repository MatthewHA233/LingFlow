-- 添加 order 字段到 sentences 表
ALTER TABLE sentences
ADD COLUMN "order" INTEGER;

-- 更新现有记录的 order 字段
WITH ordered_sentences AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY speech_id ORDER BY begin_time) as row_num
  FROM sentences
)
UPDATE sentences
SET "order" = ordered_sentences.row_num
FROM ordered_sentences
WHERE sentences.id = ordered_sentences.id;

-- 创建索引
CREATE INDEX idx_sentences_order ON sentences("order");

-- 添加非空约束
ALTER TABLE sentences
ALTER COLUMN "order" SET NOT NULL; 