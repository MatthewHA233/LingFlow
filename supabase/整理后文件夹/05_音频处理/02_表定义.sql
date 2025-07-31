-- =============================================
-- 音频处理模块 - 表定义
-- =============================================

-- 语音识别结果表
CREATE TABLE public.speech_results (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    task_id text NOT NULL,
    audio_url text NOT NULL,
    user_id uuid NULL,
    created_at timestamp without time zone NULL DEFAULT now(),
    updated_at timestamp without time zone NULL DEFAULT now(),
    status text NULL DEFAULT 'idle'::text,
    error_message text NULL,
    book_id uuid NULL,
    name text NULL,
    duration integer NULL,
    aligned_chapter_id uuid NULL,
    aligned_block_ids text[] NULL,
    alignment_metadata jsonb NULL,
    CONSTRAINT speech_results_pkey PRIMARY KEY (id),
    CONSTRAINT speech_results_book_id_fkey FOREIGN KEY (book_id) REFERENCES books (id),
    CONSTRAINT speech_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT speech_results_status_check CHECK (
        status = ANY (
            ARRAY['idle'::text, 'uploading'::text, 'processing'::text, 'completed'::text, 'error'::text, 'uploaded'::text]
        )
    )
) TABLESPACE pg_default;

COMMENT ON TABLE public.speech_results IS '语音识别结果表，存储音频处理任务的整体信息';
COMMENT ON COLUMN public.speech_results.task_id IS '任务ID';
COMMENT ON COLUMN public.speech_results.audio_url IS '音频文件URL';
COMMENT ON COLUMN public.speech_results.user_id IS '用户ID';
COMMENT ON COLUMN public.speech_results.status IS '处理状态：idle(待处理), uploading(上传中), processing(处理中), completed(完成), error(错误), uploaded(已上传)';
COMMENT ON COLUMN public.speech_results.error_message IS '错误信息';
COMMENT ON COLUMN public.speech_results.book_id IS '关联的书籍ID';
COMMENT ON COLUMN public.speech_results.name IS '识别结果名称';
COMMENT ON COLUMN public.speech_results.duration IS '音频时长（秒）';
COMMENT ON COLUMN public.speech_results.aligned_chapter_id IS '对齐的章节ID';
COMMENT ON COLUMN public.speech_results.aligned_block_ids IS '对齐的语境块ID数组';
COMMENT ON COLUMN public.speech_results.alignment_metadata IS '对齐元数据';

-- 块句子关联表（音频对齐）
CREATE TABLE public.block_sentences (
    block_id uuid NOT NULL,
    sentence_id uuid NOT NULL,
    order_index integer NOT NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    alignment_score double precision NULL,
    segment_begin_offset integer NULL,
    segment_end_offset integer NULL,
    alignment_metadata jsonb NULL DEFAULT '{}'::jsonb,
    manual_correction boolean NULL DEFAULT false,
    alignment_status text NULL DEFAULT 'automated'::text,
    CONSTRAINT block_sentences_pkey PRIMARY KEY (block_id, sentence_id),
    CONSTRAINT block_sentences_block_id_order_index_key UNIQUE (block_id, order_index),
    CONSTRAINT block_sentences_block_id_fkey FOREIGN KEY (block_id) REFERENCES context_blocks (id) ON DELETE CASCADE,
    CONSTRAINT block_sentences_sentence_id_fkey FOREIGN KEY (sentence_id) REFERENCES sentences (id) ON DELETE CASCADE,
    CONSTRAINT block_sentences_alignment_status_check CHECK (
        alignment_status = ANY (
            ARRAY['automated'::text, 'manually_adjusted'::text, 'verified'::text]
        )
    )
) TABLESPACE pg_default;

COMMENT ON TABLE public.block_sentences IS '语境块与句子的对齐关系表，用于音频文本对齐';
COMMENT ON COLUMN public.block_sentences.block_id IS '语境块ID';
COMMENT ON COLUMN public.block_sentences.sentence_id IS '句子ID';
COMMENT ON COLUMN public.block_sentences.order_index IS '句子在块中的顺序';
COMMENT ON COLUMN public.block_sentences.alignment_score IS '对齐质量分数';
COMMENT ON COLUMN public.block_sentences.segment_begin_offset IS '音频片段开始偏移量';
COMMENT ON COLUMN public.block_sentences.segment_end_offset IS '音频片段结束偏移量';
COMMENT ON COLUMN public.block_sentences.alignment_metadata IS '对齐元数据';
COMMENT ON COLUMN public.block_sentences.manual_correction IS '是否经过人工修正';
COMMENT ON COLUMN public.block_sentences.alignment_status IS '对齐状态：automated(自动), manually_adjusted(手动调整), verified(已验证)';

-- 句子表（语音识别结果）
CREATE TABLE public.sentences (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    speech_id uuid NULL,
    begin_time integer NOT NULL,
    end_time integer NOT NULL,
    text_content text NOT NULL,
    speech_rate integer NULL,
    emotion_value double precision NULL,
    created_at timestamp without time zone NULL DEFAULT now(),
    "order" integer NOT NULL,
    original_text_content text NULL,
    conversion_status public.sentence_conversion_status NULL DEFAULT 'none'::sentence_conversion_status,
    alignment_metadata jsonb NULL DEFAULT '{}'::jsonb,
    CONSTRAINT sentences_pkey PRIMARY KEY (id),
    CONSTRAINT sentences_speech_id_fkey FOREIGN KEY (speech_id) REFERENCES speech_results (id)
) TABLESPACE pg_default;

COMMENT ON TABLE public.sentences IS '句子表，存储语音识别的句子级别结果';
COMMENT ON COLUMN public.sentences.speech_id IS '关联的语音识别结果ID';
COMMENT ON COLUMN public.sentences.begin_time IS '句子开始时间（毫秒）';
COMMENT ON COLUMN public.sentences.end_time IS '句子结束时间（毫秒）';
COMMENT ON COLUMN public.sentences.text_content IS '识别出的文本内容';
COMMENT ON COLUMN public.sentences.speech_rate IS '语速（字/分钟）';
COMMENT ON COLUMN public.sentences.emotion_value IS '情感值';
COMMENT ON COLUMN public.sentences.created_at IS '创建时间';
COMMENT ON COLUMN public.sentences."order" IS '句子在语音中的顺序';
COMMENT ON COLUMN public.sentences.original_text_content IS '原始文本内容（转换前）';
COMMENT ON COLUMN public.sentences.conversion_status IS '转换状态';
COMMENT ON COLUMN public.sentences.alignment_metadata IS '对齐元数据';

-- 单词表（词级别对齐）
CREATE TABLE public.words (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    sentence_id uuid NULL,
    word text NOT NULL,
    begin_time integer NOT NULL,
    end_time integer NOT NULL,
    created_at timestamp without time zone NULL DEFAULT now(),
    original_word text NULL,
    manual_correction boolean NULL DEFAULT false,
    CONSTRAINT words_pkey PRIMARY KEY (id),
    CONSTRAINT words_sentence_id_fkey FOREIGN KEY (sentence_id) REFERENCES sentences (id)
) TABLESPACE pg_default;

COMMENT ON TABLE public.words IS '单词表，存储语音识别的词级别对齐结果';
COMMENT ON COLUMN public.words.sentence_id IS '所属句子ID';
COMMENT ON COLUMN public.words.word IS '识别出的单词';
COMMENT ON COLUMN public.words.begin_time IS '单词开始时间（毫秒）';
COMMENT ON COLUMN public.words.end_time IS '单词结束时间（毫秒）';
COMMENT ON COLUMN public.words.created_at IS '创建时间';
COMMENT ON COLUMN public.words.original_word IS '原始单词（修正前）';
COMMENT ON COLUMN public.words.manual_correction IS '是否经过人工修正';