-- =============================================
-- 书籍管理模块 - 索引定义
-- =============================================

-- books 表索引
CREATE INDEX IF NOT EXISTS idx_books_user_id 
    ON public.books USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_books_status 
    ON public.books USING btree (status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_books_type 
    ON public.books USING btree (type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_books_updated_at 
    ON public.books USING btree (updated_at DESC) TABLESPACE pg_default;

-- chapters 表索引
CREATE INDEX IF NOT EXISTS idx_chapters_book_id 
    ON public.chapters USING btree (book_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_chapters_parent_id 
    ON public.chapters USING btree (parent_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_chapters_order_index 
    ON public.chapters USING btree (order_index) TABLESPACE pg_default;

-- book_resources 表索引
CREATE INDEX IF NOT EXISTS idx_book_resources_book_id 
    ON public.book_resources USING btree (book_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_book_resources_chapter_id 
    ON public.book_resources USING btree (chapter_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_book_resources_context_block_id 
    ON public.book_resources USING btree (context_block_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_book_resources_resource_type 
    ON public.book_resources USING btree (resource_type) TABLESPACE pg_default;

-- reading_progress 表索引
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_id 
    ON public.reading_progress USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_reading_progress_book_id 
    ON public.reading_progress USING btree (book_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_reading_progress_chapter_id 
    ON public.reading_progress USING btree (chapter_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_reading_progress_updated_at 
    ON public.reading_progress USING btree (updated_at DESC) TABLESPACE pg_default;