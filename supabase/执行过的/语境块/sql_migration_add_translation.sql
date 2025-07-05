-- 为context_blocks表添加翻译字段
-- 迁移文件：添加翻译功能支持

-- 添加翻译内容字段
ALTER TABLE public.context_blocks 
ADD COLUMN translation_content text NULL;

-- 添加翻译状态字段（可选，用于跟踪翻译状态）
ALTER TABLE public.context_blocks 
ADD COLUMN translation_status text NULL DEFAULT 'none' CHECK (translation_status IN ('none', 'translating', 'completed', 'error'));

-- 添加翻译元数据字段（可选，用于存储翻译相关的额外信息）
ALTER TABLE public.context_blocks 
ADD COLUMN translation_metadata jsonb NULL DEFAULT '{}'::jsonb;

-- 添加翻译更新时间字段（可选，用于跟踪翻译最后更新时间）
ALTER TABLE public.context_blocks 
ADD COLUMN translation_updated_at timestamp with time zone NULL;

-- 创建翻译内容索引（可选，如果需要搜索翻译内容）
CREATE INDEX IF NOT EXISTS idx_context_blocks_translation_status 
ON public.context_blocks USING btree (translation_status) 
TABLESPACE pg_default;

-- 添加触发器，当translation_content更新时自动更新translation_updated_at
CREATE OR REPLACE FUNCTION update_translation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.translation_content IS DISTINCT FROM OLD.translation_content THEN
        NEW.translation_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_context_blocks_translation_updated_at
    BEFORE UPDATE ON public.context_blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_translation_updated_at();

-- 添加注释
COMMENT ON COLUMN public.context_blocks.translation_content IS '块的翻译内容';
COMMENT ON COLUMN public.context_blocks.translation_status IS '翻译状态：none-无翻译，translating-翻译中，completed-已完成，error-错误';
COMMENT ON COLUMN public.context_blocks.translation_metadata IS '翻译相关的元数据，如翻译引擎、语言等';
COMMENT ON COLUMN public.context_blocks.translation_updated_at IS '翻译内容最后更新时间'; 