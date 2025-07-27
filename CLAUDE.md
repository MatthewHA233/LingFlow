# Claude Code 自定义配置

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
⚠️ **代码仓库中的 Supabase SQL 文件具有滞后性**
- 仓库中的 SQL 文件可能与当前 Supabase 客户端的实际数据库结构相差甚远
- 在分析数据库相关问题时，不能完全依赖仓库中的 SQL 文件
- 需要通过实际的数据库查询或 Supabase 管理界面来确认当前的数据库结构
- 建议在修改数据库结构前先确认当前的实际状态


## 其他项目配置

- 项目路径：`D:\my_pro\web_ob\LingFlow`
- 主要技术栈：React, TypeScript, Supabase, Next.js