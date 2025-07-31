-- =============================================
-- 用户管理模块 - 表定义
-- =============================================

-- 旧用户表（用于特殊登录提示）
CREATE TABLE public.old_auth_users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email character varying(255) NOT NULL,
    has_registered boolean NULL DEFAULT false,
    registered_at timestamp with time zone NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT old_auth_users_pkey PRIMARY KEY (id),
    CONSTRAINT old_auth_users_email_key UNIQUE (email)
) TABLESPACE pg_default;

COMMENT ON TABLE public.old_auth_users IS '旧用户表，用于记录旧系统用户，提供登录时的特殊提示';
COMMENT ON COLUMN public.old_auth_users.email IS '用户邮箱';
COMMENT ON COLUMN public.old_auth_users.has_registered IS '是否已在新系统注册';
COMMENT ON COLUMN public.old_auth_users.registered_at IS '在新系统的注册时间';
COMMENT ON COLUMN public.old_auth_users.created_at IS '记录创建时间';
COMMENT ON COLUMN public.old_auth_users.updated_at IS '记录更新时间';

-- 用户档案表
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NULL,
    role public.user_role NOT NULL DEFAULT 'user'::user_role,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

COMMENT ON TABLE public.profiles IS '用户档案表，存储用户的基本信息和角色';
COMMENT ON COLUMN public.profiles.id IS '用户ID，与auth.users表关联';
COMMENT ON COLUMN public.profiles.email IS '用户邮箱';
COMMENT ON COLUMN public.profiles.role IS '用户角色：user(普通用户), admin(管理员)';
COMMENT ON COLUMN public.profiles.created_at IS '档案创建时间';
COMMENT ON COLUMN public.profiles.updated_at IS '档案更新时间';