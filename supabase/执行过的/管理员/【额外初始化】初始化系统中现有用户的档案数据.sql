/*
文件说明：初始化系统中现有用户的档案数据

主要功能：
1. 数据初始化
   - 为系统中的现有用户创建对应的profiles记录
   - 设置用户基本信息：id、email、role
   - 设置时间戳：created_at、updated_at

2. 用户角色分配
   - 设置特定用户(1528919811@qq.com)为管理员(admin)角色
   - 其他用户默认设置为普通用户(user)角色

3. 冲突处理
   - 使用ON CONFLICT (id)处理可能的重复插入
   - 遇到冲突时更新email、role和updated_at
   - 保证数据一致性

使用场景：
- 系统初始化时的用户数据迁移
- 确保所有用户都有对应的档案记录
- 建立基本的用户权限体系
*/

-- 为现有用户创建profiles记录
INSERT INTO profiles (id, email, role, created_at, updated_at)
VALUES 
  ('0672da90-4808-4b1e-a246-a5d50b3fa643', '1528919811@qq.com', 'admin', NOW(), NOW()),
  ('06f0a357-6489-4452-8eb4-5c0f99adfeaa', 'rshuaiyang@gmail.com', 'user', NOW(), NOW()),
  ('09ae7494-10eb-4239-a008-594e7e5f6bcb', '2088442894@qq.com', 'user', NOW(), NOW()),
  ('13012284-782f-442b-870f-d2e51fd5fcf0', 'zbx4567@gmail.com', 'user', NOW(), NOW()),
  ('324ded9d-add9-4e17-82bc-422ade950762', '3254841901@qq.com', 'user', NOW(), NOW()),
  ('38778ee8-27ac-4315-bd9c-d3b65c0022b3', 'matthewha233@gmail.com', 'user', NOW(), NOW()),
  ('478bdd6a-c86e-4218-9c40-dc06f83f2b68', '326831165@qq.com', 'user', NOW(), NOW()),
  ('500dc63c-76bf-429b-a979-4a02cd44cd3b', 'sevenseek@163.com', 'user', NOW(), NOW()),
  ('54aac4ec-e43f-4b2b-b37a-09c159490ea5', 'hjwks1314@163.com', 'user', NOW(), NOW()),
  ('6ac4aac7-0a40-4b7d-98e3-1cb5cb87c5b8', 'ame_thyst@126.com', 'user', NOW(), NOW()),
  ('a572c27f-d597-4d05-a177-9d62cb751f40', '505808326@qq.com', 'user', NOW(), NOW()),
  ('cead220c-fa22-4daa-97c0-766baa8a0295', '3104812079@qq.com', 'user', NOW(), NOW()),
  ('dc3ed875-9a1d-434f-8d99-309063e02e51', '2778910072@qq.com', 'user', NOW(), NOW()),
  ('eaebe7bc-853b-4de4-8274-369f2d676bf3', '2462232386@qq.com', 'user', NOW(), NOW()),
  ('f94a39e6-277f-4285-8b63-4af25d207086', 'enjoywords@qq.com', 'user', NOW(), NOW())
ON CONFLICT (id) DO UPDATE 
SET 
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = NOW(); 