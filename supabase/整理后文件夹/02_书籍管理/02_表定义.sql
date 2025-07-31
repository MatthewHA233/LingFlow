-- =============================================
-- 书籍管理模块 - 表定义
-- =============================================

-- 书籍表
CREATE TABLE public.books (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    author text NOT NULL,
    cover_url text NULL,
    description text NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    user_id uuid NULL,
    epub_path text NULL,
    audio_path text NULL,
    metadata jsonb NULL DEFAULT '{}'::jsonb,
    status text NULL DEFAULT 'processing'::text,
    last_read_at timestamp with time zone NULL,
    last_position jsonb NULL DEFAULT '{}'::jsonb,
    type public.book_type NOT NULL DEFAULT 'book'::book_type,
    note_count integer NOT NULL DEFAULT 0,
    last_accessed_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT books_pkey PRIMARY KEY (id),
    CONSTRAINT books_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT books_status_check CHECK (
        status = ANY (
            ARRAY['processing'::text, 'ready'::text, 'error'::text]
        )
    )
) TABLESPACE pg_default;

COMMENT ON TABLE public.books IS '书籍表，存储用户的书籍和笔记本';
COMMENT ON COLUMN public.books.title IS '书籍标题';
COMMENT ON COLUMN public.books.author IS '作者';
COMMENT ON COLUMN public.books.cover_url IS '封面图片URL';
COMMENT ON COLUMN public.books.description IS '书籍描述';
COMMENT ON COLUMN public.books.user_id IS '所属用户ID';
COMMENT ON COLUMN public.books.epub_path IS 'EPUB文件路径';
COMMENT ON COLUMN public.books.audio_path IS '音频文件路径';
COMMENT ON COLUMN public.books.metadata IS '书籍元数据';
COMMENT ON COLUMN public.books.status IS '处理状态：processing(处理中), ready(就绪), error(错误)';
COMMENT ON COLUMN public.books.last_read_at IS '最后阅读时间';
COMMENT ON COLUMN public.books.last_position IS '最后阅读位置';
COMMENT ON COLUMN public.books.type IS '类型：book(书籍), notebook(笔记本)';
COMMENT ON COLUMN public.books.note_count IS '笔记数量（仅用于笔记本）';
COMMENT ON COLUMN public.books.last_accessed_at IS '最后访问时间';

-- 章节表
CREATE TABLE public.chapters (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    book_id uuid NULL,
    title text NOT NULL,
    order_index integer NOT NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    resources jsonb NULL DEFAULT '{}'::jsonb,
    parent_id uuid NULL,
    CONSTRAINT chapters_pkey PRIMARY KEY (id),
    CONSTRAINT chapters_book_id_order_index_key UNIQUE (book_id, order_index),
    CONSTRAINT chapters_book_id_fkey FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
    CONSTRAINT chapters_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES content_parents (id)
) TABLESPACE pg_default;

COMMENT ON TABLE public.chapters IS '章节表，存储书籍的章节信息';
COMMENT ON COLUMN public.chapters.book_id IS '所属书籍ID';
COMMENT ON COLUMN public.chapters.title IS '章节标题';
COMMENT ON COLUMN public.chapters.order_index IS '章节顺序';
COMMENT ON COLUMN public.chapters.resources IS '章节资源信息';
COMMENT ON COLUMN public.chapters.parent_id IS '关联的内容父级ID';

-- 书籍资源表
CREATE TABLE public.book_resources (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    book_id uuid NULL,
    chapter_id uuid NULL,
    original_path text NOT NULL,
    oss_path text NOT NULL,
    resource_type text NOT NULL,
    mime_type text NOT NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    metadata jsonb NULL DEFAULT '{}'::jsonb,
    context_block_id uuid NULL,
    CONSTRAINT book_resources_pkey PRIMARY KEY (id),
    CONSTRAINT book_resources_book_id_fkey FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
    CONSTRAINT book_resources_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE CASCADE,
    CONSTRAINT book_resources_context_block_id_fkey FOREIGN KEY (context_block_id) REFERENCES context_blocks (id),
    CONSTRAINT book_resources_resource_type_check CHECK (
        resource_type = ANY (
            ARRAY['image'::text, 'font'::text, 'css'::text, 'other'::text]
        )
    )
) TABLESPACE pg_default;

COMMENT ON TABLE public.book_resources IS '书籍资源表，存储书籍相关的图片、字体、样式等资源';
COMMENT ON COLUMN public.book_resources.book_id IS '所属书籍ID';
COMMENT ON COLUMN public.book_resources.chapter_id IS '所属章节ID';
COMMENT ON COLUMN public.book_resources.original_path IS '原始文件路径';
COMMENT ON COLUMN public.book_resources.oss_path IS 'OSS存储路径';
COMMENT ON COLUMN public.book_resources.resource_type IS '资源类型：image(图片), font(字体), css(样式), other(其他)';
COMMENT ON COLUMN public.book_resources.mime_type IS 'MIME类型';
COMMENT ON COLUMN public.book_resources.metadata IS '资源元数据';
COMMENT ON COLUMN public.book_resources.context_block_id IS '关联的语境块ID';

-- 阅读进度表
CREATE TABLE public.reading_progress (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NULL,
    book_id uuid NULL,
    chapter_id uuid NULL,
    progress double precision NULL,
    last_position jsonb NULL DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT reading_progress_pkey PRIMARY KEY (id),
    CONSTRAINT reading_progress_user_id_book_id_key UNIQUE (user_id, book_id),
    CONSTRAINT reading_progress_book_id_fkey FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
    CONSTRAINT reading_progress_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE CASCADE,
    CONSTRAINT reading_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT reading_progress_progress_check CHECK ((progress >= 0.0) AND (progress <= 100.0))
) TABLESPACE pg_default;

COMMENT ON TABLE public.reading_progress IS '阅读进度表，记录用户的书籍阅读进度';
COMMENT ON COLUMN public.reading_progress.user_id IS '用户ID';
COMMENT ON COLUMN public.reading_progress.book_id IS '书籍ID';
COMMENT ON COLUMN public.reading_progress.chapter_id IS '当前阅读章节ID';
COMMENT ON COLUMN public.reading_progress.progress IS '阅读进度百分比(0-100)';
COMMENT ON COLUMN public.reading_progress.last_position IS '最后阅读位置的详细信息';
COMMENT ON COLUMN public.reading_progress.updated_at IS '进度更新时间';