# LingFlow

LingFlow 是一个现代化的第二语言学习平台，基于 Next.js 13+ 构建，提供丰富的学习工具和社区互动功能。

## 主要功能

- 📚 资源导入
- 📖 智能阅读器
- 👥 社区互动
- 🔍 锚点域交互
- 🎯 个性化学习路径
- 🔄 跨平台同步

## 技术栈

- **前端框架**: Next.js 13+
- **UI组件**: 
  - Radix UI
  - Tailwind CSS
  - Framer Motion
- **状态管理**: Zustand
- **数据存储**: Supabase
- **开发语言**: TypeScript
- **测试框架**: Jest

## 开始使用

### 环境要求

- Node.js 16.x 或更高版本
- npm 或 yarn 包管理器
- 现代浏览器（支持ES6+）

### 安装步骤

1. 克隆项目
```bash
git clone [项目地址]
cd LingFlow
```

2. 安装依赖
```bash
npm install
# 或
yarn install
```

3. 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local 文件，填入必要的环境变量
```

4. 启动开发服务器
```bash
npm run dev
# 或
yarn dev
```

5. 构建生产版本
```bash
npm run build
# 或
yarn build
```

### 可用的脚本命令

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run start` - 启动生产服务器（端口4000）
- `npm run test` - 运行测试
- `npm run test:watch` - 以监视模式运行测试
- `npm run test:coverage` - 生成测试覆盖率报告
- `npm run lint` - 运行代码检查

## 项目结构

```
LingFlow/
├── app/                # Next.js 应用主目录
├── components/         # 可复用组件
├── hooks/             # 自定义React Hooks
├── lib/               # 工具函数和库
├── public/            # 静态资源
├── stores/            # 状态管理
├── types/             # TypeScript类型定义
└── supabase/          # 数据库配置
```

## 开发规范

- 遵循TypeScript严格模式
- 使用ESLint进行代码规范检查
- 遵循组件化开发原则
- 编写单元测试用例
- 使用Git Flow工作流

## 部署

项目支持多种部署方式：

- Vercel（推荐）
- Docker容器化部署
- 传统服务器部署

详细部署指南请参考部署文档。

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交Pull Request

## 许可证

[MIT License](LICENSE)

## 联系方式

如有问题或建议，请通过以下方式联系我们：

- 项目Issues
- 技术支持邮箱

## 致谢

感谢所有为项目做出贡献的开发者。 