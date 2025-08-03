# TTS 功能需求整理文档

## 核心需求概述

将 TTS（文字转语音）功能集成到现有的阅读器音频处理模块中，让用户能够选择文本内容并生成语音音频，生成的音频保存到 `speech_results` 表中，与普通上传的音频一样管理。

## 主要功能点

### 1. 触发入口
- 在阅读器音频处理相关栏目中添加 TTS 按钮
- 按钮位置：在"上传音频"按钮的左侧
- 按钮名称："TTS生成音频"

### 2. 文本选择方式
- **类似音频文本强制对齐的交互方式**
  - 不使用弹窗，而是融入右侧栏的交互流程
  - 选择语境块（Context Blocks）
  - 自动获取选中块的文本内容
  - 显示文本的开始和结束部分

### 3. 音色配置
- **默认使用英语音色**
- **提供多种英语音色选择**（美式、英式等）
- **支持多情感音色**（如 Glen、Sylus、Candice 等）
- **不需要其他语言支持**（暂时只要英语）

### 4. 技术实现要求

#### 4.1 文本处理
- 复用现有的文本清理逻辑（`cleanTextForRevAI`）
- 支持文本分块（当文本超过 1024 字节 UTF-8 限制时）
- 累加语境块时自动分块
- 并发调用 TTS API（最大 10 个并发）

#### 4.2 后端处理
- 调用豆包大模型 TTS API
- 生成的音频上传到 OSS
- 保存到 `speech_results` 表（不是新建 tts_results 表）
- 处理流程与普通音频上传一致

#### 4.3 前端界面
- **紧凑的右侧栏设计**
- **类似 ModelSelector 的音色选择器**（悬浮窗形式）
- **包含详细的设置选项**：
  - 语速调节
  - 音量调节
  - 情感选择（针对多情感音色）
  - 情感强度调节
- **实时进度显示**（处理多个文本块时）

## 已完成的部分

1. ✅ 修改了 `/app/api/tts/route.ts` 支持保存到 `speech_results` 表
2. ✅ 修复了音色 ID 识别问题（从枚举名改为实际值）
3. ✅ 修复了 `getVoicesByCategory` 返回类型问题
4. ✅ 创建了基础的 `TTSGenerator` 组件

## 需要重建的部分（因误删除）

### 1. ❌ `AudioProcessingPanel` 中的 TTS 集成

#### 状态管理
- **TTS 专用状态变量**：
  - `ttsText`: 收集的文本内容
  - `ttsVoiceType`: 选中的音色（默认 'en_female_amanda_mars_bigtts'）
  - `ttsSelectedBlocks`: 选中的块ID数组
  - `ttsStartBlock`: 起始块ID
  - `ttsEndBlock`: 结束块ID

- **处理阶段**：
  - `tts_selecting`: 选择语境块阶段
  - `tts_generating`: 配置和生成音频阶段

#### 事件系统
- **发送的事件**：
  - `enable-block-selection`: 启用语境块选择（detail: { mode: 'tts' }）
  - `mark-tts-block-selected`: 标记起始块（detail: { blockId, isStart: true }）
  - `mark-tts-blocks-selected`: 标记选择范围（detail: { selectedBlockIds }）
  - `reset-tts-selection`: 重置所有TTS选择状态
  - `disable-block-selection`: 禁用选择模式

- **监听的事件**：
  - `start-tts-selection`: 从 ReaderContent 接收，启动TTS选择流程
  - `context-block-selected`: 从 ContextBlocks 接收选择事件

### 2. ❌ `ContextBlocks` 中的 TTS 选择模式

#### 视觉样式（蓝色主题 vs 橙色音频对齐主题）
- **背景渐变**：
  - TTS选择：`from-blue-500/10 to-indigo-500/10`
  - 选中状态：`from-blue-500/20 to-indigo-500/20`
- **边框颜色**：
  - TTS模式：`border-blue-500`
  - 悬浮状态：`hover:border-blue-600`
- **文本颜色**：
  - TTS选中：`text-blue-900 dark:text-blue-100`
- **悬浮预览**：
  - 背景：`from-blue-600 to-indigo-600`
  - 文本：白色

#### TTS 选择指示器
- **起始块标记**：
  - 显示内容："T"（表示TTS起始）
  - 样式：蓝色圆形徽章，右上角定位
  - 类名：`bg-blue-500 text-white`
- **选中块标记**：
  - 显示内容："✓"
  - 样式：蓝色圆形徽章
  - 位置：右上角

#### 状态变量
- `isTTSMode`: 是否处于TTS选择模式
- `ttsStartBlock`: TTS起始块ID
- `ttsSelectedBlocks`: TTS选中块ID数组
- `isTTSStartBlock`: 当前块是否是TTS起始块
- `isTTSSelectedBlock`: 当前块是否被TTS选中

#### 事件监听
- `start-tts-selection`: 启动TTS选择模式
- `mark-tts-block-selected`: 标记单个起始块
- `mark-tts-blocks-selected`: 标记选择范围内的所有块
- `reset-tts-selection`: 重置所有TTS状态
- `disable-block-selection`: 退出选择模式

### 3. ❌ 完整的 TTS 组件体系

#### 文本分块处理（text-chunker）
- 自动检测UTF-8字节数（使用 Buffer.from(text, 'utf8').length）
- 超过1024字节时自动分块
- 智能断句：优先在句号、问号、感叹号处分割
- 保持语义完整性
- 返回分块信息：每块的字节数、字符数、内容

#### 批量生成管理（batch-processor）
- 最多10个并发请求限制
- 指数退避重试机制（最多3次）
- 进度回调函数
- 错误收集和报告
- 音频块顺序保证

#### 音频合并功能
- 后端使用适当工具合并音频
- 保持块的正确顺序
- 合并后的音频上传到OSS
- 返回最终的音频URL

#### 进度显示组件
- 显示总块数和已完成块数
- 当前处理中的块编号
- 进度条可视化
- 错误提示和重试选项
- 预计剩余时间（可选）

## 关键交互流程

1. 用户点击"TTS生成音频"按钮
2. 进入语境块选择模式（蓝色主题）
3. 选择起始块和结束块
4. 系统自动收集并清理文本
5. 如果文本超长，自动分块
6. 显示音色选择和设置界面
7. 用户选择音色和调整参数
8. 点击生成，显示进度
9. 生成完成后，音频出现在音频列表中

## 注意事项

- 不创建新的数据库表
- 复用现有的音频上传和管理流程
- 界面要紧凑，适合右侧栏
- 保持与现有交互风格的一致性

## 待确认的细节

1. 音频合并的具体实现方式？
2. 是否需要保存用户的音色偏好设置？
3. 错误处理和重试机制的具体要求？
4. 是否需要支持取消正在进行的生成任务？

---

*此文档基于对话记录整理，可能有遗漏或理解偏差，请补充完善。*