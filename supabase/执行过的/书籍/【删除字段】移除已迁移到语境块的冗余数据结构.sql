/*
文件说明：移除已迁移到语境块的冗余数据结构

主要操作：
1. 从chapters表中移除content字段（内容已迁移到语境块）
2. 添加chapters表与content_parents的关联
3. 保留book_resources表及其数据
4. 保留必要的基础字段

注意事项：
- 在执行删除操作前确保章节内容已经迁移到语境块
- 保持外键关系的完整性
- 确保不影响现有的RLS策略
- 保留资源管理功能
*/

-- 开始事务
BEGIN;

-- 1. 从chapters表中移除content字段
ALTER TABLE chapters 
  DROP COLUMN IF EXISTS content;

-- 2. 添加与content_parents的关联
ALTER TABLE chapters 
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES content_parents(id);

-- 3. 创建索引以优化关联查询
CREATE INDEX IF NOT EXISTS idx_chapters_parent_id 
  ON chapters(parent_id);

-- 4. 为book_resources表添加新的关联字段（如果需要）
ALTER TABLE book_resources
  ADD COLUMN IF NOT EXISTS context_block_id UUID REFERENCES context_blocks(id);

-- 5. 创建资源关联索引
CREATE INDEX IF NOT EXISTS idx_book_resources_context_block 
  ON book_resources(context_block_id);

-- 提交事务
COMMIT;

/*
后续迁移说明：

1. 数据迁移流程：
   - 为每个chapter创建对应的content_parent记录
   - 将chapter的内容解析为语境块
   - 更新chapter的parent_id
   - 将资源与对应的语境块（主要是图片块）关联起来

2. 资源管理调整：
   - book_resources表继续保留，用于存储所有资源文件
   - 通过context_block_id字段，可以将资源与具体的语境块关联
   - 图片类型的语境块可以引用book_resources中的资源

3. API调整：
   - 更新上传接口以支持语境块创建
   - 修改章节内容的保存逻辑
   - 调整内容获取接口
   - 保持资源上传和管理功能不变

4. 前端适配：
   - 更新编辑器以支持块级操作
   - 调整内容渲染逻辑
   - 实现块级别的拖拽功能
   - 保持资源管理和显示功能
*/ 