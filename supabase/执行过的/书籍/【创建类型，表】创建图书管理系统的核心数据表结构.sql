/*
文件说明：创建图书管理系统的核心数据表结构

主要表结构：
1. books（图书表）
   - 基本信息：标题、作者、封面URL、描述
   - 文件路径：epub文件路径、音频文件路径
   - 元数据：支持存储额外的图书信息
   - 状态追踪：处理状态、最后阅读时间、阅读位置
   - 关联用户ID，支持用户私有图书管理

2. chapters（章节表）
   - 基本信息：标题、内容、排序索引
   - 关联图书ID，实现章节归属关系
   - 资源管理：支持存储章节相关资源
   - 唯一约束：确保每本书的章节顺序唯一

特点：
- 使用UUID作为主键，提供更好的分布式支持
- 自动维护创建和更新时间
- 支持JSON格式的元数据和资源存储
- 实现了基本的用户权限控制
- 包含完整的外键约束确保数据完整性

使用场景：
- 电子书管理系统
- 有声书应用
- 在线阅读平台
*/

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 书籍基本信息表
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  epub_path TEXT,
  audio_path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  last_read_at TIMESTAMP WITH TIME ZONE,
  last_position JSONB DEFAULT '{}'::jsonb
);

-- 章节表
CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resources JSONB DEFAULT '{}'::jsonb,
  UNIQUE(book_id, order_index)
);