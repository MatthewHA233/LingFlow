-- =============================================
-- 锚点域模块 - 表定义
-- =============================================

-- 锚点表
CREATE TABLE public.anchors (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    text text NOT NULL,
    type public.anchor_type NOT NULL DEFAULT 'word'::anchor_type,
    language text NULL DEFAULT 'zh'::text,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    total_contexts integer NULL DEFAULT 0,
    total_meaning_blocks integer NULL DEFAULT 0,
    last_reviewed_at timestamp with time zone NULL,
    user_id uuid NULL,
    CONSTRAINT anchors_pkey PRIMARY KEY (id),
    CONSTRAINT anchors_text_language_unique UNIQUE (text, language),
    CONSTRAINT anchors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id)
) TABLESPACE pg_default;

COMMENT ON TABLE public.anchors IS '锚点表，存储单词、短语和复合词';
COMMENT ON COLUMN public.anchors.text IS '锚点文本内容';
COMMENT ON COLUMN public.anchors.type IS '锚点类型：word(单词)、phrase(短语)、compound(复合词)';
COMMENT ON COLUMN public.anchors.language IS '语言代码';
COMMENT ON COLUMN public.anchors.total_contexts IS '关联的语境总数';
COMMENT ON COLUMN public.anchors.total_meaning_blocks IS '关联的含义块总数';
COMMENT ON COLUMN public.anchors.last_reviewed_at IS '最后复习时间';
COMMENT ON COLUMN public.anchors.user_id IS '所属用户ID';

-- 含义块表
CREATE TABLE public.meaning_blocks (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    anchor_id uuid NOT NULL,
    meaning text NOT NULL,
    tags text[] NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    current_proficiency double precision NULL DEFAULT 0.0,
    review_count integer NULL DEFAULT 0,
    next_review_date timestamp with time zone NULL,
    easiness_factor double precision NULL DEFAULT 2.5,
    interval_days integer NULL DEFAULT 1,
    user_id uuid NULL,
    CONSTRAINT meaning_blocks_pkey PRIMARY KEY (id),
    CONSTRAINT meaning_blocks_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES anchors (id) ON DELETE CASCADE,
    CONSTRAINT meaning_blocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id)
) TABLESPACE pg_default;

COMMENT ON TABLE public.meaning_blocks IS '含义块表，存储锚点的不同含义和记忆信息';
COMMENT ON COLUMN public.meaning_blocks.anchor_id IS '关联的锚点ID';
COMMENT ON COLUMN public.meaning_blocks.meaning IS '含义描述';
COMMENT ON COLUMN public.meaning_blocks.tags IS '标签数组';
COMMENT ON COLUMN public.meaning_blocks.current_proficiency IS '当前熟练度';
COMMENT ON COLUMN public.meaning_blocks.review_count IS '复习次数';
COMMENT ON COLUMN public.meaning_blocks.next_review_date IS '下次复习日期';
COMMENT ON COLUMN public.meaning_blocks.easiness_factor IS '记忆难易度因子';
COMMENT ON COLUMN public.meaning_blocks.interval_days IS '复习间隔天数';
COMMENT ON COLUMN public.meaning_blocks.user_id IS '所属用户ID';

-- 含义块与语境块关联表
CREATE TABLE public.meaning_block_contexts (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    meaning_block_id uuid NOT NULL,
    context_block_id uuid NOT NULL,
    start_position integer NULL,
    end_position integer NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    confidence_score double precision NULL DEFAULT 1.0,
    user_id uuid NULL,
    original_word_form text NULL,
    original_sentence text NULL,
    context_explanation text NULL,
    CONSTRAINT meaning_block_contexts_pkey PRIMARY KEY (id),
    CONSTRAINT meaning_block_contexts_unique UNIQUE (meaning_block_id, context_block_id),
    CONSTRAINT meaning_block_contexts_meaning_block_id_fkey FOREIGN KEY (meaning_block_id) REFERENCES meaning_blocks (id) ON DELETE CASCADE,
    CONSTRAINT meaning_block_contexts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT meaning_block_contexts_context_block_id_fkey FOREIGN KEY (context_block_id) REFERENCES context_blocks (id) ON DELETE CASCADE
) TABLESPACE pg_default;

COMMENT ON TABLE public.meaning_block_contexts IS '含义块与语境块的关联表';
COMMENT ON COLUMN public.meaning_block_contexts.meaning_block_id IS '含义块ID';
COMMENT ON COLUMN public.meaning_block_contexts.context_block_id IS '语境块ID';
COMMENT ON COLUMN public.meaning_block_contexts.start_position IS '在语境块中的开始位置';
COMMENT ON COLUMN public.meaning_block_contexts.end_position IS '在语境块中的结束位置';
COMMENT ON COLUMN public.meaning_block_contexts.confidence_score IS '关联置信度分数';
COMMENT ON COLUMN public.meaning_block_contexts.user_id IS '创建关联的用户ID';
COMMENT ON COLUMN public.meaning_block_contexts.original_word_form IS '原始词形（在语境中的实际形式）';
COMMENT ON COLUMN public.meaning_block_contexts.original_sentence IS '原始句子';
COMMENT ON COLUMN public.meaning_block_contexts.context_explanation IS '语境解释';

-- 熟练度记录表
CREATE TABLE public.proficiency_records (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    meaning_block_id uuid NOT NULL,
    reviewed_at timestamp with time zone NULL DEFAULT now(),
    proficiency_before double precision NOT NULL,
    proficiency_after double precision NOT NULL,
    quality_score integer NOT NULL,
    review_duration_seconds integer NULL,
    user_id uuid NULL,
    CONSTRAINT proficiency_records_pkey PRIMARY KEY (id),
    CONSTRAINT proficiency_records_meaning_block_id_fkey FOREIGN KEY (meaning_block_id) REFERENCES meaning_blocks (id) ON DELETE CASCADE,
    CONSTRAINT proficiency_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT proficiency_records_quality_score_check CHECK ((quality_score >= 0) AND (quality_score <= 5))
) TABLESPACE pg_default;

COMMENT ON TABLE public.proficiency_records IS '熟练度记录表，记录每次复习的详细信息';
COMMENT ON COLUMN public.proficiency_records.meaning_block_id IS '含义块ID';
COMMENT ON COLUMN public.proficiency_records.reviewed_at IS '复习时间';
COMMENT ON COLUMN public.proficiency_records.proficiency_before IS '复习前熟练度';
COMMENT ON COLUMN public.proficiency_records.proficiency_after IS '复习后熟练度';
COMMENT ON COLUMN public.proficiency_records.quality_score IS '复习质量评分(0-5)';
COMMENT ON COLUMN public.proficiency_records.review_duration_seconds IS '复习持续时间(秒)';
COMMENT ON COLUMN public.proficiency_records.user_id IS '复习用户ID';