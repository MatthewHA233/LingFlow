-- 为speech_results表添加新字段
ALTER TABLE public.speech_results 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS duration INTEGER, -- 音频时长，单位：秒
ADD COLUMN IF NOT EXISTS aligned_chapter_id UUID, -- 对齐后分配的章节ID
ADD COLUMN IF NOT EXISTS aligned_block_ids TEXT[], -- 对齐的语境块ID数组
ADD COLUMN IF NOT EXISTS alignment_metadata JSONB; -- 对齐元数据

-- 添加外键约束（如果有chapters表的话）
-- ALTER TABLE public.speech_results 
-- ADD CONSTRAINT speech_results_aligned_chapter_id_fkey 
-- FOREIGN KEY (aligned_chapter_id) REFERENCES chapters(id);

-- 添加注释
COMMENT ON COLUMN public.speech_results.name IS '音频文件名称';
COMMENT ON COLUMN public.speech_results.duration IS '音频时长（秒）';
COMMENT ON COLUMN public.speech_results.aligned_chapter_id IS '对齐后分配的章节ID';
COMMENT ON COLUMN public.speech_results.aligned_block_ids IS '对齐的语境块ID数组';
COMMENT ON COLUMN public.speech_results.alignment_metadata IS '对齐元数据，包含对齐参数、置信度等信息';

-- 为新字段创建索引
CREATE INDEX IF NOT EXISTS idx_speech_results_aligned_chapter_id 
ON public.speech_results USING btree (aligned_chapter_id);

CREATE INDEX IF NOT EXISTS idx_speech_results_duration 
ON public.speech_results USING btree (duration);

-- 为JSONB字段创建GIN索引以支持快速查询
CREATE INDEX IF NOT EXISTS idx_speech_results_alignment_metadata 
ON public.speech_results USING gin (alignment_metadata);