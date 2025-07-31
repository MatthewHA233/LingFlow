-- =============================================
-- 音频处理模块 - 枚举类型定义
-- =============================================

-- 句子转换状态
CREATE TYPE public.sentence_conversion_status AS ENUM (
    'none', 
    'converting', 
    'converted', 
    'failed', 
    'reverted'
);
COMMENT ON TYPE public.sentence_conversion_status IS '句子级别的转换状态';