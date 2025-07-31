-- =============================================
-- 通用功能模块 - 枚举类型定义
-- =============================================

-- 存储提供商
CREATE TYPE public.storage_provider AS ENUM (
    'oss', 
    'local'
);
COMMENT ON TYPE public.storage_provider IS '文件存储提供商类型';