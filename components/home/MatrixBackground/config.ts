// 配置参数
export const config = {
  // 基础设置
  charSize: 14, // 减小字符大小
  density: 0.8, // 控制字符密度(0-1)
  baseSpeed: 1.2, // 基础下落速度
  speedVariation: 0.8, // 速度变化范围
  
  // 颜色设置
  colors: {
    primary: 'rgba(140, 255, 140, 0.8)',
    bright: 'rgba(180, 255, 180, 0.95)',
    dim: 'rgba(140, 255, 140, 0.3)',
    trail: 'rgba(0, 0, 0, 0.15)' // 拖尾效果的透明度
  },
  
  // 动画效果
  flickerRate: 0.05, // 字符闪烁概率
  fadeLength: 20, // 渐变尾部长度
  
  // 随机字符集
  chars: '洪流二语习得'.split('')
};

// 精选的多语言问候语(减少数量,突出重点语言)
export const greetings = [
  "你好世界", // 中文
  "Hello World", // 英语
  "こんにちは", // 日语
  "안녕하세요", // 韩语
  "Bonjour", // 法语
  "Hola", // 西班牙语
  "Ciao", // 意大利语
  "Hallo", // 德语
  "Olá", // 葡萄牙语
  "Привет" // 俄语
];