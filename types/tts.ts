// TTS 音色类型定义
export interface VoiceInfo {
  id: string;           // voice_type
  name: string;         // 音色名称
  category: string;     // 分类
  language: string;     // 语种
  gender?: 'male' | 'female';  // 性别
  description?: string; // 描述
  emotions?: string[];  // 支持的情感
  accent?: string;      // 口音
  businessParties?: string[]; // 上线业务方
}

// 音色分类 - 动态从 CSV 中获取
export type VoiceCategory = string;

// 情感映射
export const emotionLabels: Record<string, string> = {
  'happy': '开心',
  'sad': '悲伤',
  'angry': '愤怒',
  'surprised': '惊讶',
  'fear': '恐惧',
  'hate': '厌恶',
  'excited': '兴奋',
  'coldness': '冷漠',
  'neutral': '中性',
  'affectionate': '深情',
  'asmr': 'ASMR',
  'chat': '对话/闲聊',
  'warm': '温暖',
  'authoritative': '权威',
  'depressed': '沮丧',
  'lovey-dovey': '撒娇',
  'shy': '害羞',
  'comfort': '安慰鼓励',
  'tension': '焦急',
  'tender': '温柔',
  'storytelling': '讲故事',
  'radio': '情感电台',
  'magnetic': '磁性',
  'advertising': '广告营销',
  'vocal-fry': '气泡音',
  'news': '新闻播报',
  'entertainment': '娱乐八卦',
  'dialect': '方言'
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
          '冷漠': 'coldness',
          '中性': 'neutral',
          '深情': 'affectionate',
          'ASMR': 'asmr',
          '对话/闲聊': 'chat',
          '温暖': 'warm',
          '权威': 'authoritative',
          '沮丧': 'depressed',
          '兴奋': 'excited',
          '愉悦': 'happy'
        };
        
        // 使用正则分割，支持中文逗号、中文顿号、英文逗号等
        const emotionParts = emotions.split(/[，、,]/);
        
        for (const emotion of emotionParts) {
          const trimmed = emotion.trim();
          if (!trimmed) continue;
          
          // 转换为英文参数或保持原样
          const mapped = emotionMap[trimmed] || trimmed.toLowerCase();
          
          // 避免重复
          if (!emotionList.includes(mapped)) {
            emotionList.push(mapped);
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
      
      voicesData.push({
        id: voiceType,
        name,
        category,
        language,
        gender,
        description,
        emotions: emotionList.length > 0 ? emotionList : undefined,
        businessParties: businessParties && businessParties.trim() ? 
          businessParties.split(/[，、,]/).map(s => s.trim()).filter(Boolean) : undefined
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
  if (!isLoaded) {
    console.warn('警告：音色数据尚未加载');
    return [];
  }
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