-- =============================================
-- 音频处理模块 - 索引定义
-- =============================================

-- speech_results 表索引
CREATE INDEX IF NOT EXISTS idx_speech_results_user_id 
    ON public.speech_results USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_speech_results_task_id 
    ON public.speech_results USING btree (task_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_speech_results_status 
    ON public.speech_results USING btree (status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_speech_results_created_at 
    ON public.speech_results USING btree (created_at) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_speech_results_duration 
    ON public.speech_results USING btree (duration) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_speech_results_aligned_chapter_id 
    ON public.speech_results USING btree (aligned_chapter_id) TABLESPACE pg_default;

-- GIN 索引用于 JSONB 字段
CREATE INDEX IF NOT EXISTS idx_speech_results_alignment_metadata 
    ON public.speech_results USING gin (alignment_metadata) TABLESPACE pg_default;

-- block_sentences 表索引
CREATE INDEX IF NOT EXISTS idx_block_sentences_block_id 
    ON public.block_sentences USING btree (block_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_block_sentences_sentence_id 
    ON public.block_sentences USING btree (sentence_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_block_sentences_order 
    ON public.block_sentences USING btree (order_index) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_block_sentences_alignment_score 
    ON public.block_sentences USING btree (alignment_score) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_block_sentences_manual_correction 
    ON public.block_sentences USING btree (manual_correction) TABLESPACE pg_default;

-- sentences 表索引  
CREATE INDEX IF NOT EXISTS idx_sentences_speech_id 
    ON public.sentences USING btree (speech_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_sentences_begin_time 
    ON public.sentences USING btree (begin_time) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_sentences_conversion_status 
    ON public.sentences USING btree (conversion_status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_sentences_order 
    ON public.sentences USING btree ("order") TABLESPACE pg_default;

-- words 表索引
CREATE INDEX IF NOT EXISTS idx_words_sentence_id 
    ON public.words USING btree (sentence_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_words_begin_time 
    ON public.words USING btree (begin_time) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_words_end_time 
    ON public.words USING btree (end_time) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_words_word 
    ON public.words USING btree (word) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_words_manual_correction 
    ON public.words USING btree (manual_correction) TABLESPACE pg_default;