-- =============================================
-- 语境块模块 - 表定义
-- =============================================

-- 内容父级表
CREATE TABLE public.content_parents (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    content_type public.content_type NOT NULL,
    title text NOT NULL,
    description text NULL,
    metadata jsonb NULL DEFAULT '{}'::jsonb,
    user_id uuid NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT content_parents_pkey PRIMARY KEY (id),
    CONSTRAINT content_parents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

COMMENT ON TABLE public.content_parents IS '内容父级表，统一管理不同类型内容的共享属性';
COMMENT ON COLUMN public.content_parents.content_type IS '内容类型：chapter(章节), video(视频), custom_page(自定义页面), collection(集合)';
COMMENT ON COLUMN public.content_parents.title IS '标题';
COMMENT ON COLUMN public.content_parents.description IS '描述';
COMMENT ON COLUMN public.content_parents.metadata IS '元数据';
COMMENT ON COLUMN public.content_parents.user_id IS '所属用户ID';

-- 语境块表
CREATE TABLE public.context_blocks (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    parent_id uuid NULL,
    block_type public.block_type NOT NULL,
    content text NULL,
    order_index integer NOT NULL,
    metadata jsonb NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    speech_id uuid NULL,
    begin_time integer NULL,
    end_time integer NULL,
    original_content text NULL,
    conversion_status public.context_block_conversion_status NULL DEFAULT 'none'::context_block_conversion_status,
    conversion_metadata jsonb NULL DEFAULT '{}'::jsonb,
    translation_content text NULL,
    translation_status text NULL DEFAULT 'none'::text,
    translation_metadata jsonb NULL DEFAULT '{}'::jsonb,
    translation_updated_at timestamp with time zone NULL,
    CONSTRAINT context_blocks_pkey PRIMARY KEY (id),
    CONSTRAINT context_blocks_parent_id_order_index_key UNIQUE (parent_id, order_index) DEFERRABLE,
    CONSTRAINT context_blocks_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES content_parents (id) ON DELETE CASCADE,
    CONSTRAINT context_blocks_speech_id_fkey FOREIGN KEY (speech_id) REFERENCES speech_results (id),
    CONSTRAINT context_blocks_translation_status_check CHECK (
        translation_status = ANY (
            ARRAY['none'::text, 'translating'::text, 'completed'::text, 'error'::text]
        )
    )
) TABLESPACE pg_default;

COMMENT ON TABLE public.context_blocks IS '语境块表，存储内容的具体块';
COMMENT ON COLUMN public.context_blocks.parent_id IS '父级内容ID';
COMMENT ON COLUMN public.context_blocks.block_type IS '块类型';
COMMENT ON COLUMN public.context_blocks.content IS '块内容';
COMMENT ON COLUMN public.context_blocks.order_index IS '块在父级中的顺序';
COMMENT ON COLUMN public.context_blocks.metadata IS '块元数据';
COMMENT ON COLUMN public.context_blocks.speech_id IS '关联的语音识别结果ID';
COMMENT ON COLUMN public.context_blocks.begin_time IS '音频开始时间（毫秒）';
COMMENT ON COLUMN public.context_blocks.end_time IS '音频结束时间（毫秒）';
COMMENT ON COLUMN public.context_blocks.original_content IS '原始内容（转换前）';
COMMENT ON COLUMN public.context_blocks.conversion_status IS '转换状态';
COMMENT ON COLUMN public.context_blocks.conversion_metadata IS '转换元数据';
COMMENT ON COLUMN public.context_blocks.translation_content IS '翻译内容';
COMMENT ON COLUMN public.context_blocks.translation_status IS '翻译状态';
COMMENT ON COLUMN public.context_blocks.translation_metadata IS '翻译元数据';
COMMENT ON COLUMN public.context_blocks.translation_updated_at IS '翻译更新时间';