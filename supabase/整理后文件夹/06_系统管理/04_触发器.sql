-- =============================================
-- 系统管理模块 - 触发器定义
-- =============================================

-- system_config 表触发器
CREATE TRIGGER update_system_config_updated_at 
    BEFORE UPDATE ON system_config 
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- system_notifications 表触发器
CREATE TRIGGER trigger_create_notification_status 
    AFTER INSERT ON system_notifications 
    FOR EACH ROW
    EXECUTE FUNCTION create_notification_status();

-- 注：update_updated_at_column 和 create_notification_status 函数需要在03_函数.sql中定义