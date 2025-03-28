/*
文件说明：为语音识别结果中的句子添加顺序字段

主要功能：
1. 为sentences表添加order字段
   - 类型：INTEGER
   - 用途：记录每个speech_id下句子的顺序号

2. 数据更新：
   - 使用ROW_NUMBER()为现有数据按begin_time自动编号
   - 按speech_id分组，确保每段语音的句子独立编号

3. 性能优化：
   - 创建order字段的索引以提升查询性能
   - 添加非空约束确保数据完整性

使用场景：
- 按时间顺序显示语音识别的句子
- 支持句子重排序功能
- 优化相关查询性能
*/

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