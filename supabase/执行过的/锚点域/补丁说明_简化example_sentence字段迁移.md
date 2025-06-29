# 补丁说明：简化 example_sentence 字段迁移

## 背景
原本的设计中，`meaning_blocks` 表使用 `example_sentence` JSONB 字段来存储例句信息，但这种设计存在以下问题：
1. 数据冗余：例句信息与 `meaning_block_contexts` 表中的信息重复
2. 查询复杂：需要处理 JSONB 数组的展开和合并
3. 维护困难：两个地方存储相似数据容易不一致

## 解决方案
将例句相关的信息完全迁移到 `meaning_block_contexts` 表中，实现数据的标准化存储。

## 具体变更

### 1. 数据库结构调整
- **删除字段**：`meaning_blocks.example_sentence` (JSONB)
- **新增字段**：
  - `meaning_block_contexts.original_sentence` (TEXT) - 原句
  - `meaning_block_contexts.context_explanation` (TEXT) - 语境解释

### 2. 视图更新
- 更新 `meaning_blocks_formatted` 视图：从 `meaning_block_contexts` 表获取例句信息
- 更新 `meaning_blocks_summary` 视图：提供例句统计信息

### 3. API 代码调整
- `app/api/anchors/process/route.ts`：简化含义块创建逻辑，移除 `example_sentence` 处理
- `lib/services/anchor-service.ts`：更新服务接口
- `app/api/anchors/stats/route.ts`：移除统计接口中的 `example_sentence` 引用

### 4. 类型定义更新
- `types/anchor.ts`：移除 `MeaningBlock` 接口中的 `example_sentence` 字段

## 优势
1. **数据一致性**：单一数据源，避免重复和不一致
2. **查询简化**：直接通过关系表查询，无需处理 JSONB 数组
3. **扩展性**：更容易添加新的例句相关字段
4. **性能优化**：减少 JSONB 操作，提高查询效率

## 影响范围
- 不影响现有功能的使用
- 含义重复检测逻辑保持不变
- 前端展示逻辑无需调整（通过视图保持兼容）

## 注意事项
- 此补丁为结构性调整，不包含数据迁移
- 执行前请确保相关应用代码已更新
- 建议在测试环境先验证功能正常 