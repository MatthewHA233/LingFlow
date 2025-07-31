-- =============================================
-- 系统管理模块 - 表定义
-- =============================================

-- 系统配置表
CREATE TABLE public.system_config (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT system_config_pkey PRIMARY KEY (key)
) TABLESPACE pg_default;

COMMENT ON TABLE public.system_config IS '系统配置表，存储系统级别的配置参数';
COMMENT ON COLUMN public.system_config.key IS '配置键名';
COMMENT ON COLUMN public.system_config.value IS '配置值（JSON格式）';
COMMENT ON COLUMN public.system_config.updated_at IS '配置更新时间';

-- 系统通知表
CREATE TABLE public.system_notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title text NOT NULL,
    message text NOT NULL,
    type public.message_type NOT NULL DEFAULT 'info'::message_type,
    created_at timestamp with time zone NULL DEFAULT now(),
    created_by uuid NULL,
    is_active boolean NULL DEFAULT true,
    CONSTRAINT system_notifications_pkey PRIMARY KEY (id),
    CONSTRAINT system_notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id)
) TABLESPACE pg_default;

COMMENT ON TABLE public.system_notifications IS '系统通知表，存储管理员发布的系统级通知';
COMMENT ON COLUMN public.system_notifications.title IS '通知标题';
COMMENT ON COLUMN public.system_notifications.message IS '通知内容';
COMMENT ON COLUMN public.system_notifications.type IS '通知类型：info(信息), success(成功), warning(警告), error(错误)';
COMMENT ON COLUMN public.system_notifications.created_at IS '创建时间';
COMMENT ON COLUMN public.system_notifications.created_by IS '创建者用户ID（管理员）';
COMMENT ON COLUMN public.system_notifications.is_active IS '是否激活状态';

-- 用户通知状态表
CREATE TABLE public.user_notification_status (
    user_id uuid NOT NULL,
    notification_id uuid NOT NULL,
    read_at timestamp with time zone NULL,
    CONSTRAINT user_notification_status_pkey PRIMARY KEY (user_id, notification_id),
    CONSTRAINT user_notification_status_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES system_notifications (id),
    CONSTRAINT user_notification_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

COMMENT ON TABLE public.user_notification_status IS '用户通知状态表，记录每个用户对系统通知的阅读状态';
COMMENT ON COLUMN public.user_notification_status.user_id IS '用户ID';
COMMENT ON COLUMN public.user_notification_status.notification_id IS '通知ID';
COMMENT ON COLUMN public.user_notification_status.read_at IS '阅读时间，NULL表示未读';