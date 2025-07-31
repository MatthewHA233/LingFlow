-- =============================================
-- 系统管理模块 - 索引定义
-- =============================================

-- system_config 表索引
CREATE INDEX IF NOT EXISTS idx_system_config_updated_at 
    ON public.system_config USING btree (updated_at DESC) TABLESPACE pg_default;

-- GIN 索引用于 JSONB 字段
CREATE INDEX IF NOT EXISTS idx_system_config_value 
    ON public.system_config USING gin (value) TABLESPACE pg_default;

-- system_notifications 表索引
CREATE INDEX IF NOT EXISTS idx_system_notifications_created_at 
    ON public.system_notifications USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_system_notifications_type 
    ON public.system_notifications USING btree (type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_system_notifications_is_active 
    ON public.system_notifications USING btree (is_active) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_system_notifications_created_by 
    ON public.system_notifications USING btree (created_by) TABLESPACE pg_default;

-- user_notification_status 表索引
CREATE INDEX IF NOT EXISTS idx_user_notification_status_user_id 
    ON public.user_notification_status USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_notification_status_notification_id 
    ON public.user_notification_status USING btree (notification_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_notification_status_read_at 
    ON public.user_notification_status USING btree (read_at) TABLESPACE pg_default;