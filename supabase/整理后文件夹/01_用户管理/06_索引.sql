-- =============================================
-- 用户管理模块 - 索引定义
-- =============================================

-- old_auth_users 表索引
CREATE INDEX IF NOT EXISTS idx_old_auth_users_email 
    ON public.old_auth_users USING btree (email) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_old_auth_users_has_registered 
    ON public.old_auth_users USING btree (has_registered) TABLESPACE pg_default;

-- profiles 表索引
CREATE INDEX IF NOT EXISTS idx_profiles_email 
    ON public.profiles USING btree (email) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_profiles_role 
    ON public.profiles USING btree (role) TABLESPACE pg_default;