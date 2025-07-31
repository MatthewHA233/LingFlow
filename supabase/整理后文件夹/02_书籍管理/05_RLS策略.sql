-- 02_书籍管理模块 - RLS策略定义

-- 启用 books 表的 RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 启用 chapters 表的 RLS
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

-- 启用 reading_progress 表的 RLS
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;

-- 启用 book_resources 表的 RLS
ALTER TABLE book_resources ENABLE ROW LEVEL SECURITY;

-- books 表的 RLS 策略

-- 查看公开书籍（所有用户都可以查看书籍）
CREATE POLICY "查看公开书籍" 
ON books FOR SELECT 
TO public 
USING (true);

-- 插入自己的书籍
CREATE POLICY "插入自己的书籍" 
ON books FOR INSERT 
TO public 
WITH CHECK (auth.uid() = user_id);

-- 修改自己的书籍
CREATE POLICY "修改自己的书籍" 
ON books FOR UPDATE 
TO public 
USING (auth.uid() = user_id);

-- 删除自己的书籍
CREATE POLICY "删除自己的书籍" 
ON books FOR DELETE 
TO public 
USING (auth.uid() = user_id);

-- 用户访问自己的书籍（认证用户的所有操作）
CREATE POLICY "用户访问自己的书籍" 
ON books FOR ALL 
TO authenticated 
USING (user_id = auth.uid());

-- 管理员完全访问（通过auth.users表验证）
CREATE POLICY "管理员完全访问" 
ON books FOR ALL 
TO public 
USING (EXISTS (
  SELECT 1
  FROM auth.users
  WHERE users.id = auth.uid() 
    AND users.role::text = 'admin'::text
));

-- 管理员访问所有书籍（通过profiles表验证）
CREATE POLICY "管理员访问所有书籍" 
ON books FOR ALL 
TO authenticated 
USING (EXISTS (
  SELECT 1
  FROM profiles
  WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'::user_role
));

-- chapters 表的 RLS 策略

-- 查看公开章节（所有用户都可以查看章节）
CREATE POLICY "查看公开章节" 
ON chapters FOR SELECT 
TO public 
USING (EXISTS (
  SELECT 1
  FROM books
  WHERE books.id = chapters.book_id
));

-- 修改自己的章节（用户可以对自己书籍的章节进行所有操作）
CREATE POLICY "修改自己的章节" 
ON chapters FOR ALL 
TO public 
USING (EXISTS (
  SELECT 1
  FROM books
  WHERE books.id = chapters.book_id 
    AND books.user_id = auth.uid()
));

-- 用户访问自己的章节（认证用户访问自己书籍的章节）
CREATE POLICY "用户访问自己的章节" 
ON chapters FOR ALL 
TO authenticated 
USING (EXISTS (
  SELECT 1
  FROM books
  WHERE books.id = chapters.book_id 
    AND books.user_id = auth.uid()
));

-- book_resources 表的 RLS 策略

-- 查看公开资源（所有用户都可以查看资源）
CREATE POLICY "查看公开资源" 
ON book_resources FOR SELECT 
TO public 
USING (EXISTS (
  SELECT 1
  FROM books
  WHERE books.id = book_resources.book_id
));

-- 修改自己的资源（public角色用户可以修改自己书籍的资源）
CREATE POLICY "修改自己的资源" 
ON book_resources FOR ALL 
TO public 
USING (EXISTS (
  SELECT 1
  FROM books
  WHERE books.id = book_resources.book_id 
    AND books.user_id = auth.uid()
));

-- 用户访问自己的资源（认证用户可以访问自己书籍的资源）
CREATE POLICY "用户访问自己的资源" 
ON book_resources FOR ALL 
TO authenticated 
USING (EXISTS (
  SELECT 1
  FROM books
  WHERE books.id = book_resources.book_id 
    AND books.user_id = auth.uid()
));

-- reading_progress 表的 RLS 策略

-- 查看自己的阅读进度
CREATE POLICY "查看自己的阅读进度" 
ON reading_progress FOR SELECT 
TO public 
USING (auth.uid() = user_id);

-- 修改自己的阅读进度（包括所有操作）
CREATE POLICY "修改自己的阅读进度" 
ON reading_progress FOR ALL 
TO public 
USING (auth.uid() = user_id);