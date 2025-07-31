-- =============================================
-- 用户管理模块 - 枚举类型定义
-- =============================================

-- 用户角色
CREATE TYPE public.user_role AS ENUM (
    'user', 
    'admin'
);
COMMENT ON TYPE public.user_role IS '系统用户角色';