-- =============================================
-- 语境块模块 - 索引定义
-- =============================================

-- content_parents 表索引
CREATE INDEX IF NOT EXISTS idx_content_parents_content_type 
    ON public.content_parents USING btree (content_type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_content_parents_user_id 
    ON public.content_parents USING btree (user_id) TABLESPACE pg_default;

-- context_blocks 表索引
CREATE INDEX IF NOT EXISTS idx_context_blocks_parent_id 
    ON public.context_blocks USING btree (parent_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_context_blocks_order 
    ON public.context_blocks USING btree (order_index) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_context_blocks_type 
    ON public.context_blocks USING btree (block_type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_context_blocks_speech_id 
    ON public.context_blocks USING btree (speech_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_context_blocks_translation_status 
    ON public.context_blocks USING btree (translation_status) TABLESPACE pg_default;