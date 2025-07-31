-- =============================================
-- 用户管理模块 - 触发器定义
-- =============================================

-- old_auth_users 表触发器
CREATE TRIGGER trigger_update_old_auth_users_updated_at 
    BEFORE UPDATE ON old_auth_users 
    FOR EACH ROW
    EXECUTE FUNCTION update_old_auth_users_updated_at();

-- profiles 表触发器
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 注：update_old_auth_users_updated_at 和 update_updated_at_column 函数需要在03_函数.sql中定义