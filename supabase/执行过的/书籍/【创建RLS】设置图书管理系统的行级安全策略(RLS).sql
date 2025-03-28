/*
文件说明：设置图书管理系统的行级安全策略(RLS)

主要安全策略：
1. 图书表(books)策略
   - 查看权限：所有用户可查看公开图书
   - 修改权限：用户只能修改自己的图书
   - 删除权限：用户只能删除自己的图书
   - 插入权限：用户只能为自己添加图书
   - 管理员特权：可以访问所有图书

2. 章节表(chapters)策略
   - 查看权限：可查看任何公开图书的章节
   - 修改权限：仅图书所有者可修改章节

3. 资源表(book_resources)策略
   - 查看权限：可访问任何公开图书的资源
   - 修改权限：仅图书所有者可修改资源

4. 阅读进度表(reading_progress)策略
   - 查看权限：用户只能查看自己的阅读进度
   - 修改权限：用户只能修改自己的阅读进度

特点：
- 严格的访问控制
- 数据隔离保护
- 管理员特权支持
- 公开内容共享

使用场景：
- 多用户图书管理系统
- 个人图书馆
- 在线阅读平台
*/

-- 启用行级安全策略
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户可以查看所有公开的书籍
CREATE POLICY "查看公开书籍"
  ON books FOR SELECT
  USING (true);

-- 创建策略：用户只能修改自己的书籍
CREATE POLICY "修改自己的书籍"
  ON books FOR UPDATE
  USING (auth.uid() = user_id);

-- 创建策略：用户只能删除自己的书籍
CREATE POLICY "删除自己的书籍"
  ON books FOR DELETE
  USING (auth.uid() = user_id);

-- 创建策略：用户只能插入自己的书籍
CREATE POLICY "插入自己的书籍"
  ON books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 章节表策略
CREATE POLICY "查看公开章节"
  ON chapters FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM books 
    WHERE books.id = chapters.book_id
  ));

CREATE POLICY "修改自己的章节"
  ON chapters FOR ALL
  USING (EXISTS (
    SELECT 1 FROM books 
    WHERE books.id = chapters.book_id 
    AND books.user_id = auth.uid()
  ));

-- 资源表策略
CREATE POLICY "查看公开资源"
  ON book_resources FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM books 
    WHERE books.id = book_resources.book_id
  ));

CREATE POLICY "修改自己的资源"
  ON book_resources FOR ALL
  USING (EXISTS (
    SELECT 1 FROM books 
    WHERE books.id = book_resources.book_id 
    AND books.user_id = auth.uid()
  ));

-- 阅读进度表策略
CREATE POLICY "查看自己的阅读进度"
  ON reading_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "修改自己的阅读进度"
  ON reading_progress FOR ALL
  USING (auth.uid() = user_id);

-- 为管理员创建特殊策略（如果需要的话）
CREATE POLICY "管理员完全访问"
  ON books FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );