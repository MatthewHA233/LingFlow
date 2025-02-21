/*
文件说明：移除已迁移到语境块的冗余数据结构

主要操作：
1. 从chapters表中移除content字段（内容已迁移到语境块）
2. 从chapters表中移除resources字段（资源已通过语境块管理）
3. 添加chapters表与content_parents的关联
4. 保留必要的基础字段

注意事项：
- 在执行删除操作前确保数据已经迁移
- 保持外键关系的完整性
- 确保不影响现有的RLS策略
*/

-- 开始事务
BEGIN;

-- 1. 从chapters表中移除不再需要的字段
ALTER TABLE chapters 
  DROP COLUMN IF EXISTS content,
  DROP COLUMN IF EXISTS resources;

-- 2. 添加与content_parents的关联
ALTER TABLE chapters 
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES content_parents(id);

-- 3. 创建索引以优化关联查询
CREATE INDEX IF NOT EXISTS idx_chapters_parent_id 
  ON chapters(parent_id);

-- 提交事务
COMMIT;

/*
后续迁移说明：

1. 数据迁移流程：
   - 为每个chapter创建对应的content_parent记录
   - 将chapter的内容解析为语境块
   - 更新chapter的parent_id

2. API调整：
   - 更新上传接口以支持语境块创建
   - 修改章节内容的保存逻辑
   - 调整内容获取接口

3. 前端适配：
   - 更新编辑器以支持块级操作
   - 调整内容渲染逻辑
   - 实现块级别的拖拽功能
*/ 