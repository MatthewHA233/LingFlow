-- =============================================
-- 语境块模块 - 枚举类型定义
-- =============================================

-- 语境块类型
CREATE TYPE public.block_type AS ENUM (
    'text', 
    'heading_1', 
    'heading_2', 
    'heading_3', 
    'heading_4', 
    'heading_5', 
    'heading_6', 
    'image', 
    'audio_aligned', 
    'video_aligned'
);
COMMENT ON TYPE public.block_type IS '内容块类型，用于定义不同类型的内容块';

-- 通用转换状态
CREATE TYPE public.conversion_status AS ENUM (
    'none', 
    'converting', 
    'converted', 
    'failed', 
    'reverted'
);
COMMENT ON TYPE public.conversion_status IS '通用转换状态';

-- 语境块转换状态
CREATE TYPE public.context_block_conversion_status AS ENUM (
    'none', 
    'completed', 
    'partially_converted', 
    'reverted'
);
COMMENT ON TYPE public.context_block_conversion_status IS '语境块的转换状态';