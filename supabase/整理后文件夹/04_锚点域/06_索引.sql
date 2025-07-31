-- =============================================
-- 锚点域模块 - 索引定义
-- =============================================

-- anchors 表索引
CREATE INDEX IF NOT EXISTS idx_anchors_text 
    ON public.anchors USING btree (text) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_anchors_type 
    ON public.anchors USING btree (type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_anchors_user_id 
    ON public.anchors USING btree (user_id) TABLESPACE pg_default;

-- meaning_blocks 表索引
CREATE INDEX IF NOT EXISTS idx_meaning_blocks_anchor_id 
    ON public.meaning_blocks USING btree (anchor_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meaning_blocks_user_id 
    ON public.meaning_blocks USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meaning_blocks_next_review_date 
    ON public.meaning_blocks USING btree (next_review_date) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meaning_blocks_proficiency 
    ON public.meaning_blocks USING btree (current_proficiency) TABLESPACE pg_default;

-- meaning_block_contexts 表索引
CREATE INDEX IF NOT EXISTS idx_meaning_block_contexts_meaning_block 
    ON public.meaning_block_contexts USING btree (meaning_block_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meaning_block_contexts_context_block 
    ON public.meaning_block_contexts USING btree (context_block_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meaning_block_contexts_user_id 
    ON public.meaning_block_contexts USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meaning_block_contexts_word_position 
    ON public.meaning_block_contexts USING btree (original_word_form, start_position, end_position) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meaning_block_contexts_original_sentence 
    ON public.meaning_block_contexts USING btree (original_sentence) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meaning_block_contexts_context_explanation 
    ON public.meaning_block_contexts USING btree (context_explanation) TABLESPACE pg_default;

-- proficiency_records 表索引
CREATE INDEX IF NOT EXISTS idx_proficiency_records_meaning_block 
    ON public.proficiency_records USING btree (meaning_block_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_proficiency_records_user_id 
    ON public.proficiency_records USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_proficiency_records_reviewed_at 
    ON public.proficiency_records USING btree (reviewed_at DESC) TABLESPACE pg_default;