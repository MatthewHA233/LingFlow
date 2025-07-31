-- =============================================
-- 锚点域模块 - 枚举类型定义
-- =============================================

-- 锚点类型
CREATE TYPE public.anchor_type AS ENUM (
    'word', 
    'phrase', 
    'compound'
);
COMMENT ON TYPE public.anchor_type IS '锚点类型，用于区分单词、短语和复合词';