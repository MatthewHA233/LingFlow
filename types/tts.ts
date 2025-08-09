// TTS 音色类型定义
export interface VoiceInfo {
  id: string;           // voice_type (用于API调用)
  uniqueKey: string;    // 唯一标识符 (用于React渲染)
  name: string;         // 音色名称
  category: string;     // 分类
  language: string;     // 语种
  gender?: 'male' | 'female';  // 性别
  description?: string; // 描述
  emotions?: string[];  // 支持的情感
  accent?: string;      // 口音
  businessParties?: string[]; // 上线业务方
  features?: string[];  // 特色功能
  demoText?: string | Array<{  // 试听文本 - 支持单个文本或多语言文本数组
    name: string;       // 语言名称（对于双语音色）
    text: string;       // 试听文本内容
  }>;
  demoUrls?: Array<{    // 试听URL
    name: string;       // 显示名称（对于双语音色）
    url: string;        // 试听URL
  }>;
}

// 音色分类 - 动态从 CSV 中获取
export type VoiceCategory = string;

// 情感映射
export const emotionLabels: Record<string, string> = {
  // 中文音色情感
  'happy': '开心',
  'sad': '悲伤',
  'angry': '愤怒',
  'surprised': '惊讶',
  'fear': '恐惧',
  'hate': '厌恶',
  'excited': '兴奋',
  'coldness': '冷漠',
  'neutral': '中性',
  'depressed': '沮丧',
  'lovey-dovey': '撒娇',
  'shy': '害羞',
  'comfort': '安慰鼓励',
  'tension': '咆哮/焦急',
  'tender': '温柔',
  'storytelling': '讲故事/自然讲述',
  'radio': '情感电台',
  'magnetic': '磁性',
  'advertising': '广告营销',
  'vocal-fry': '气泡音',
  'asmr': '低语(ASMR)',
  'news': '新闻播报',
  'entertainment': '娱乐八卦',
  'dialect': '方言',
  // 英文音色情感
  'chat': '对话/闲聊',
  'warm': '温暖',
  'affectionate': '深情',
  'authoritative': '权威'
};

// 存储加载的音色数据
let voicesData: VoiceInfo[] = [];
let isLoaded = false;

// 解析 CSV 行（处理包含逗号的字段）
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // 添加最后一个字段
  result.push(current.trim());
  
  return result;
}

// 从 CSV 加载音色数据
export async function loadVoicesFromCSV(): Promise<void> {
  // 强制重新加载，即使已经加载过
  // if (isLoaded) return;
  
  try {
    const response = await fetch('/音色列表.csv');
    if (!response.ok) {
      throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    
    if (!text || text.length === 0) {
      throw new Error('CSV file is empty');
    }
    
    // 移除 BOM 字符（如果存在）
    const cleanText = text.replace(/^\uFEFF/, '');
    
    // 解析 CSV
    const lines = cleanText.split('\n').filter(line => line.trim());
    
    console.log('CSV 加载成功，总行数:', lines.length);
    
    voicesData = [];
    let parsedCount = 0;
    let skippedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      
      // 确保有足够的字段
      if (values.length < 4) continue;
      
      const scene = values[0] || '';
      const name = values[1] || '';
      const voiceType = values[2] || '';
      const language = values[3] || '';
      const emotions = values[4] || '';
      const businessParties = values[5] || '';
      const demoText = values[6] || '';  // 试听文本
      const demoUrlsStr = values[7] || '';  // 试听URL列
      
      // 跳过无效数据
      if (!scene || !name || !voiceType) {
        skippedCount++;
        continue;
      }
      
      parsedCount++;
      
      // 直接使用 CSV 中的场景作为分类
      const category = scene;
      
      // 解析情感
      const emotionList: string[] = [];
      if (emotions && emotions.trim()) {
        // 将中文情感转换为英文参数的映射表
        const emotionMap: Record<string, string> = {
          '开心': 'happy',
          '悲伤': 'sad',
          '生气': 'angry',
          '愤怒': 'angry',
          '惊讶': 'surprised',
          '恐惧': 'fear',
          '厌恶': 'hate',
          '激动': 'excited',
          '兴奋': 'excited',
          '冷漠': 'coldness',
          '中性': 'neutral',
          '沮丧': 'depressed',
          '撒娇': 'lovey-dovey',
          '害羞': 'shy',
          '安慰鼓励': 'comfort',
          '咆哮': 'tension',
          '焦急': 'tension',
          '温柔': 'tender',
          '讲故事': 'storytelling',
          '自然讲述': 'storytelling',
          '情感电台': 'radio',
          '磁性': 'magnetic',
          '广告营销': 'advertising',
          '气泡音': 'vocal-fry',
          '低语': 'asmr',
          'ASMR': 'asmr',
          '新闻播报': 'news',
          '娱乐八卦': 'entertainment',
          '方言': 'dialect',
          // 英文音色情感
          '愉悦': 'happy',
          '对话/闲聊': 'chat',
          '对话': 'chat',
          '闲聊': 'chat',
          '温暖': 'warm',
          '深情': 'affectionate',
          '权威': 'authoritative'
        };
        
        // 使用正则分割，支持中文逗号、中文顿号、英文逗号等
        const emotionParts = emotions.split(/[，、,]/);
        
        for (const emotion of emotionParts) {
          const trimmed = emotion.trim();
          if (!trimmed) continue;
          
          // 如果在映射表中找到了对应的英文参数，使用英文参数
          // 否则保持原样（可能本身就是英文参数）
          if (emotionMap[trimmed]) {
            const mapped = emotionMap[trimmed];
            if (!emotionList.includes(mapped)) {
              emotionList.push(mapped);
            }
          } else {
            // 检查是否已经是英文参数
            const lowerTrimmed = trimmed.toLowerCase();
            if (!emotionList.includes(lowerTrimmed)) {
              emotionList.push(lowerTrimmed);
            }
          }
        }
      }
      
      // 判断性别
      let gender: 'male' | 'female' | undefined;
      if (voiceType.includes('male') && !voiceType.includes('female')) {
        gender = 'male';
      } else if (voiceType.includes('female')) {
        gender = 'female';
      }
      
      // 创建描述
      let description = name;
      if (language) {
        description += ` - ${language}`;
      }
      if (gender) {
        description += gender === 'male' ? '男声' : '女声';
      }
      
      // 解析试听URL
      const demoUrls: Array<{name: string, url: string}> = [];
      if (demoUrlsStr && demoUrlsStr.trim()) {
        // 处理双语音色格式: 名称1|URL1;名称2|URL2
        if (demoUrlsStr.includes('|')) {
          const parts = demoUrlsStr.split(';');
          for (const part of parts) {
            const [partName, partUrl] = part.split('|');
            if (partName && partUrl) {
              demoUrls.push({ name: partName.trim(), url: partUrl.trim() });
            }
          }
        } else {
          // 单一URL，使用音色名称
          demoUrls.push({ name: name, url: demoUrlsStr.trim() });
        }
      }
      
      // 解析试听文本 - 支持双语格式
      let parsedDemoText: string | Array<{name: string, text: string}> | undefined;
      if (demoText && demoText.trim()) {
        // 检查是否是双语格式: 名称1|文本1;名称2|文本2
        if (demoText.includes('|') && demoText.includes(';')) {
          const textArray: Array<{name: string, text: string}> = [];
          const parts = demoText.split(';');
          for (const part of parts) {
            const [partName, partText] = part.split('|');
            if (partName && partText) {
              textArray.push({ name: partName.trim(), text: partText.trim() });
            }
          }
          if (textArray.length > 0) {
            parsedDemoText = textArray;
          }
        } else {
          // 单一文本
          parsedDemoText = demoText.trim();
        }
      }
      
      voicesData.push({
        id: voiceType,
        uniqueKey: `${voiceType}_${i}_${Date.now()}`, // 生成唯一key
        name,
        category,
        language,
        gender,
        description,
        emotions: emotionList.length > 0 ? emotionList : undefined,
        businessParties: businessParties && businessParties.trim() ? 
          businessParties.split(/[，、,]/).map(s => s.trim()).filter(Boolean) : undefined,
        demoText: parsedDemoText,
        demoUrls: demoUrls.length > 0 ? demoUrls : undefined
      });
    }
    
    isLoaded = true;
    const categoryStats = voicesData.reduce((acc, v) => {
      acc[v.category] = (acc[v.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`CSV 解析完成: 总共解析 ${parsedCount} 行，跳过 ${skippedCount} 行`);
    console.log(`成功加载 ${voicesData.length} 个音色`);
    console.log('分类统计:', categoryStats);
    console.log('所有分类:', Object.keys(categoryStats).sort());
  } catch (error) {
    console.error('加载音色数据失败:', error);
    // 如果加载失败，设置为空数据
    handleLoadFailure();
  }
}

// 音色数据加载失败时的处理
function handleLoadFailure() {
  voicesData = [];
  isLoaded = true;
  console.error('音色数据加载失败，没有可用的音色');
}

// 获取所有音色
export function getAllVoices(): VoiceInfo[] {
  return [...voicesData];
}

// 根据分类获取音色
export function getVoicesByCategory(category: VoiceCategory): VoiceInfo[] {
  return getAllVoices().filter(voice => voice.category === category);
}

// 获取所有分类
export function getVoiceCategories(): VoiceCategory[] {
  const allVoices = getAllVoices();
  const categories = new Set(allVoices.map(voice => voice.category));
  return Array.from(categories).sort();
}

// 根据语言获取音色（支持多语言音色）
export function getVoicesByLanguage(language: string): VoiceInfo[] {
  const allVoices = getAllVoices();
  return allVoices.filter(voice => {
    // 将语言字段按逗号分割（处理"中文，美式英语"这种情况）
    const languages = voice.language.split(/[，,]/).map(lang => lang.trim().toLowerCase());
    const targetLang = language.toLowerCase();
    
    // 检查是否包含目标语言 - 只使用精确匹配或语言字段包含目标语言
    return languages.some(lang => {
      // 只允许精确匹配或语言字段包含目标语言（不允许反向包含）
      return lang === targetLang || lang.includes(targetLang);
    });
  });
}

// 获取按语言分组的音色（多情感音色置顶）
export function getVoicesByLanguageWithEmotionFirst(language: string): VoiceInfo[] {
  const voices = getVoicesByLanguage(language);
  
  // 分离多情感音色和普通音色（不进行去重，保留所有语言匹配的音色）
  const emotionVoices = voices.filter(voice => 
    voice.category.includes('多情感') || 
    voice.category.includes('英文多情感') ||
    (voice.emotions && voice.emotions.length > 0)
  );
  
  const normalVoices = voices.filter(voice => 
    !voice.category.includes('多情感') && 
    !voice.category.includes('英文多情感') &&
    (!voice.emotions || voice.emotions.length === 0)
  );
  
  // 多情感音色在前，普通音色在后
  return [...emotionVoices, ...normalVoices];
}

// 根据ID获取音色信息
export function getVoiceInfo(voiceId: string): VoiceInfo | null {
  return getAllVoices().find(voice => voice.id === voiceId) || null;
}

// TTS API 响应类型
export interface TTSResponse {
  data: string; // Base64 encoded audio
  status: number;
  message?: string;
}

// TTS 请求参数
export interface TTSRequest {
  text: string;
  voiceType: string;
  speedRatio?: number;
  volumeRatio?: number;
  pitchRatio?: number;
  emotion?: string;
  language?: string;
  silence_duration?: number;
}

// 清理文本（移除多余空格和换行）
export function cleanTextForRevAI(text: string): string {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 清理音色ID用于API调用（去除手动添加的尾缀）
export function cleanVoiceIdForAPI(voiceId: string): string {
  // 去除可能的尾缀，如 _es, _spanish, _jp, _japanese 等
  // 保留原始的 voice_type 用于API调用
  return voiceId.replace(/_(?:es|spanish|jp|japanese|lang\d+)$/i, '');
}