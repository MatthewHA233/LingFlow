-- 先处理依赖于chapters表的所有对象
-- 删除reading_progress表上的外键约束
ALTER TABLE IF EXISTS public.reading_progress
DROP CONSTRAINT IF EXISTS reading_progress_chapter_id_fkey;

-- 删除book_statistics视图
DROP VIEW IF EXISTS public.book_statistics;

-- 首先删除chapters表的外键约束，先处理引用它的表格
ALTER TABLE IF EXISTS public.chapters 
DROP CONSTRAINT IF EXISTS chapters_parent_id_fkey,
DROP CONSTRAINT IF EXISTS chapters_book_id_fkey;

-- 删除chapters表的相关触发器
DROP TRIGGER IF EXISTS update_chapters_updated_at ON public.chapters;
DROP TRIGGER IF EXISTS after_chapter_delete ON public.chapters;

-- 删除可能存在的向后兼容视图和触发器
DROP VIEW IF EXISTS public.chapter_view;
DROP FUNCTION IF EXISTS update_chapter_from_content_parent() CASCADE;

-- 删除chapters表
DROP TABLE IF EXISTS public.chapters;

-- 更新content_parents表，添加新字段
ALTER TABLE public.content_parents
ADD COLUMN IF NOT EXISTS book_id uuid REFERENCES books(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS order_index integer,
ADD COLUMN IF NOT EXISTS resources jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS parent_content_id uuid REFERENCES content_parents(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_content_parents_book_id ON public.content_parents USING btree (book_id);
CREATE INDEX IF NOT EXISTS idx_content_parents_parent_content_id ON public.content_parents USING btree (parent_content_id);

-- 创建唯一约束，确保同一本书中的order_index不重复
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_parents_book_order_unique 
ON public.content_parents (book_id, order_index)
WHERE content_type = 'chapter' AND book_id IS NOT NULL AND order_index IS NOT NULL;

-- 为content_parents表添加排序规则
CREATE INDEX IF NOT EXISTS idx_content_parents_order ON public.content_parents (order_index)
WHERE content_type = 'chapter';

-- 添加默认值约束
ALTER TABLE public.content_parents 
ALTER COLUMN level SET DEFAULT 1;

-- 如果需要，为reading_progress表添加新的外键关联
ALTER TABLE IF EXISTS public.reading_progress
ADD COLUMN IF NOT EXISTS content_parent_id uuid REFERENCES content_parents(id) ON DELETE CASCADE;

-- 创建新的统计视图
CREATE OR REPLACE VIEW public.book_statistics AS
SELECT 
    cp.book_id,
    COUNT(DISTINCT cp.id) AS chapter_count,
    COUNT(cb.id) AS total_block_count,
    COUNT(CASE WHEN cb.block_type = 'text' THEN 1 ELSE NULL END) AS text_block_count,
    COUNT(CASE WHEN cb.block_type::text LIKE 'heading_%' THEN 1 ELSE NULL END) AS heading_block_count,
    COUNT(CASE WHEN cb.block_type = 'image' THEN 1 ELSE NULL END) AS image_block_count,
    COUNT(CASE WHEN cb.begin_time IS NOT NULL AND cb.end_time IS NOT NULL THEN 1 ELSE NULL END) AS audio_block_count
FROM 
    content_parents cp
LEFT JOIN 
    context_blocks cb ON cp.id = cb.parent_id
WHERE 
    cp.content_type = 'chapter' AND cp.book_id IS NOT NULL
GROUP BY 
    cp.book_id;

-- 如果您需要修改enum类型来添加新的内容类型，可以这样做
-- 注意：仅当content_type为enum类型且需要添加新值时才需要
-- ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'book_section' AFTER 'chapter'; 