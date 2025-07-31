-- =============================================
-- 系统管理模块 - 枚举类型定义
-- =============================================

-- 消息类型
CREATE TYPE public.message_type AS ENUM (
    'info', 
    'success', 
    'warning', 
    'error'
);
COMMENT ON TYPE public.message_type IS '系统消息类型';