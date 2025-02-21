/*
文件说明：创建系统配置管理的数据表结构

主要组成：
1. 存储类型枚举(storage_provider)
   - oss：阿里云对象存储服务
   - local：本地存储服务
   - 用途：定义系统支持的存储方式

2. 系统配置表(system_config)
   - key：配置项的唯一标识符
   - value：使用JSONB类型存储配置值
   - updated_at：配置更新时间
   - 特点：支持复杂的JSON格式配置

3. 默认配置数据
   - 存储配置：默认使用阿里云OSS
   - 存储参数：包含bucket和region信息
   - 可扩展：支持后续添加更多配置项

使用场景：
- 系统存储方式配置
- 全局参数管理
- 系统设置的集中存储
- 动态配置更新

注意事项：
- 使用JSONB类型提供灵活的配置结构
- 自动维护配置更新时间
- 支持动态修改和扩展
*/

-- 创建一个存储类型枚举
CREATE TYPE storage_provider AS ENUM ('oss', 'local');

-- 添加系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认配置
INSERT INTO system_config (key, value) VALUES
('storage', '{"provider": "oss", "bucket": "lingflow", "region": "oss-cn-hangzhou"}');