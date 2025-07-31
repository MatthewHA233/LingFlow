# Claude Code 自定义配置

## 语言配置

⚠️ **必须使用中文进行所有交流**
- 与用户的所有对话必须使用中文
- 创建和更新 TodoList 时也必须使用中文
- 错误信息和日志输出尽量使用中文
- 代码注释应当使用中文

## 截图处理规则

当用户说"看看截图"或"你看看截图"时，自动执行以下操作：

1. 搜索路径：`C:\Users\Administrator\Desktop\屏幕截图*.png`
2. 选择最新的截图文件
3. 使用 Read 工具自动读取并分析截图内容

## 实现逻辑

```typescript
// 当检测到"看看截图"关键词时
if (userMessage.includes("看看截图")) {
  // 1. 使用 Glob 工具搜索截图
  const screenshots = glob("屏幕截图*.png", "C:\\Users\\Administrator\\Desktop");
  
  // 2. 选择最新的文件
  const latestScreenshot = screenshots[screenshots.length - 1];
  
  // 3. 使用 Read 工具读取
  const content = read(latestScreenshot);
  
  // 4. 分析并响应
}
```

## 重要注意事项

### Supabase 数据库状态
⚠️ **执行过的文件夹中的 SQL 文件具有滞后性**
- `supabase/执行过的/` 文件夹中的 SQL 文件可能与当前 Supabase 客户端的实际数据库结构存在差异
- 在分析数据库相关问题时，应优先查看 `supabase/整理后文件夹/` 中的内容
- 整理后文件夹包含了最新的、按模块组织的数据库结构
- 如需了解当前实际状态，可查看整理后文件夹或通过 Supabase 管理界面确认

### Supabase 文件夹使用规则
📁 **查询和分析数据库结构时**
- 直接查看 `supabase/整理后文件夹/` 中的内容
- 这里包含了按功能模块组织的最新数据库结构

📝 **编写一次性SQL语句时**
- 先写入 `supabase/执行过的/` 相应子文件夹中
- 执行完毕并确认无误后，将内容整理到 `supabase/整理后文件夹/` 对应模块中
- 整理时遵循现有的文件命名和组织规范


## 其他项目配置

- 项目路径：`D:\my_pro\web_ob\LingFlow`
- 主要技术栈：React, TypeScript, Supabase, Next.js