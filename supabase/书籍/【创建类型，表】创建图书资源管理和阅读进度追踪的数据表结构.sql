/*
文件说明：创建图书资源管理和阅读进度追踪的数据表结构

主要表结构：
1. book_resources（图书资源表）
   - 资源类型：图片、字体、CSS等
   - 路径管理：原始路径和OSS存储路径
   - MIME类型：用于正确处理资源
   - 元数据：支持存储额外的资源信息
   - 关联关系：与图书和章节的关联

2. reading_progress（阅读进度表）
   - 用户进度：记录阅读百分比（0-100）
   - 位置信息：存储具体阅读位置
   - 时间追踪：自动更新最后阅读时间
   - 唯一约束：确保每个用户对每本书只有一条进度记录

3. 自动更新机制
   - 更新时间戳函数：update_updated_at_column()
   - 触发器：自动维护updated_at字段
   - 应用于：books、chapters、reading_progress表

特点：
- 完整的资源管理系统
- 精确的阅读进度追踪
- 自动的时间戳更新
- 严格的数据完整性约束

使用场景：
- 电子书资源管理
- 阅读进度同步
- 多设备阅读位置同步
- 阅读数据分析
*/

-- 资源表
CREATE TABLE IF NOT EXISTS book_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  original_path TEXT NOT NULL,
  oss_path TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('image', 'font', 'css', 'other')),
  mime_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 阅读进度表
CREATE TABLE IF NOT EXISTS reading_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  progress FLOAT CHECK (progress >= 0 AND progress <= 100),
  last_position JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- 创建更新时间戳函数和触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为每个表创建触发器
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at
  BEFORE UPDATE ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_progress_updated_at
  BEFORE UPDATE ON reading_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();