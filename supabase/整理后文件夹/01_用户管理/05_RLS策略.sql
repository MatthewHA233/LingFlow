-- 01_用户管理模块 - RLS策略定义

-- 启用 old_auth_users 表的 RLS
ALTER TABLE old_auth_users ENABLE ROW LEVEL SECURITY;

-- 启用 profiles 表的 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- old_auth_users 表的 RLS 策略

-- 允许所有用户（包括匿名用户）读取旧用户信息
CREATE POLICY "Allow all users to read old_auth_users" 
ON old_auth_users FOR SELECT 
TO anon, authenticated 
USING (true);

-- 只允许认证用户更新
CREATE POLICY "Allow authenticated users to update old_auth_users" 
ON old_auth_users FOR UPDATE 
TO authenticated 
USING (true);

-- 允许服务角色进行所有操作
CREATE POLICY "Allow service role full access" 
ON old_auth_users FOR ALL 
TO service_role 
USING (true);

-- profiles 表的 RLS 策略

-- 启用所有操作（完全开放访问）
CREATE POLICY "启用所有操作" 
ON profiles FOR ALL 
TO public 
USING (true)
WITH CHECK (true);