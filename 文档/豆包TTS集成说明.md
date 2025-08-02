# 豆包 TTS 集成说明

## 概述
本项目已集成豆包（火山引擎）的 TTS（文字转语音）服务，支持将文本内容转换为自然流畅的语音。

## 环境配置

### 1. 获取 API 凭证
1. 访问[火山引擎控制台](https://console.volcengine.com/)
2. 注册并登录账号
3. 在产品列表中找到"语音技术"或"豆包 TTS"
4. 创建应用并获取以下信息：
   - `appid`：应用ID
   - `token`：访问令牌

### 2. 配置环境变量
在 `.env.local` 文件中添加以下配置：

```env
# 豆包 TTS 配置
DOUBAO_TTS_APPID=你的应用ID
DOUBAO_TTS_TOKEN=你的访问令牌
```

## API 使用说明

### 端点
```
POST /api/tts
```

### 请求头
```
Authorization: Bearer {用户认证令牌}
Content-Type: application/json
```

### 请求参数
```json
{
  "text": "要转换的文本内容",
  "voiceType": "zh_female_qingxin",  // 可选，音色类型
  "speedRatio": 1.0,                 // 可选，语速比例（0.5-2.0）
  "format": "base64"                 // 可选，返回格式（"base64" 或 "url"）
}
```

### 支持的音色类型
- `zh_female_qingxin`: 中文女声-清新
- `zh_male_M392_conversation_wvae_bigtts`: 中文男声-对话

### 响应格式

#### Base64 格式（默认）
```json
{
  "success": true,
  "data": {
    "audio": "base64编码的音频数据",
    "duration": 1960,  // 音频时长（毫秒）
    "format": "base64"
  }
}
```

#### URL 格式
```json
{
  "success": true,
  "data": {
    "url": "可直接播放的音频URL",
    "duration": 1960,  // 音频时长（毫秒）
    "format": "url"
  }
}
```

### 错误响应
```json
{
  "error": "错误描述信息"
}
```

## 前端集成示例

### 基本使用
```typescript
async function textToSpeech(text: string) {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      format: 'url'
    })
  });

  if (!response.ok) {
    throw new Error('TTS 请求失败');
  }

  const result = await response.json();
  
  if (result.success) {
    // 播放音频
    const audio = new Audio(result.data.url);
    audio.play();
  }
}
```

### 高级使用（带选项）
```typescript
interface TTSOptions {
  text: string;
  voiceType?: string;
  speedRatio?: number;
  format?: 'base64' | 'url';
}

async function synthesizeSpeech(options: TTSOptions) {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options)
  });

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'TTS 合成失败');
  }

  return result.data;
}

// 使用示例
const audioData = await synthesizeSpeech({
  text: '你好，欢迎使用豆包语音合成服务',
  voiceType: 'zh_female_qingxin',
  speedRatio: 1.2,
  format: 'url'
});
```

## 使用限制
- 单次请求文本长度限制：5000字符
- 速率限制：每分钟20次请求
- 语速比例范围：0.5-2.0
- URL 格式的音频链接有效期：5分钟

## 注意事项
1. 请妥善保管 API 凭证，不要将其提交到版本控制系统
2. 生产环境建议配置更严格的速率限制
3. 长文本建议分段处理，避免单次请求过大
4. URL 格式返回的音频链接是临时的，需要及时使用

## 故障排查
1. **401 错误**：检查用户认证令牌是否有效
2. **429 错误**：请求过于频繁，请稍后再试
3. **500 错误**：检查环境变量配置是否正确
4. **合成失败**：检查文本内容是否符合要求，音色类型是否支持