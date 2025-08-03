import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle, X, Mic, Sparkles, Globe, User, Volume2, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getVoicesByCategory, getVoiceCategories, getVoiceInfo, VoiceInfo, loadVoicesFromCSV, VoiceCategory, getVoicesByLanguageWithEmotionFirst } from '@/types/tts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface VoiceSelectorProps {
  selectedVoice: string;
  onSelect: (voiceId: string) => void;
  onClose: () => void;
}

// 分类图标映射
const categoryIcons: Record<string, React.ReactNode> = {
  '多情感': <Sparkles className="w-3.5 h-3.5" />,
  '英文多情感': <Sparkles className="w-3.5 h-3.5" />,
  '教育场景': <User className="w-3.5 h-3.5" />,
  '客服场景': <Mic className="w-3.5 h-3.5" />,
  '通用场景': <Volume2 className="w-3.5 h-3.5" />,
  '多语种': <Globe className="w-3.5 h-3.5" />,
  '日语西语': <Globe className="w-3.5 h-3.5" />,
  '趣味口音': <Zap className="w-3.5 h-3.5" />,
  '角色扮演': <User className="w-3.5 h-3.5" />,
  '视频配音': <Mic className="w-3.5 h-3.5" />,
  '有声阅读': <Volume2 className="w-3.5 h-3.5" />,
  '推荐': <Sparkles className="w-3.5 h-3.5" />
};

// 情感标签的中文映射
const emotionLabels: Record<string, string> = {
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
  'authoritative': '权威',
  // 兼容其他可能的写法
  'lovey_dovey': '撒娇',
  'vocal_fry': '气泡音',
  '开心': '开心',
  '悲伤': '悲伤',
  '愤怒': '愤怒',
  '生气': '愤怒',
  '惊讶': '惊讶',
  '恐惧': '恐惧',
  '厌恶': '厌恶',
  '兴奋': '兴奋',
  '激动': '兴奋',
  '冷漠': '冷漠',
  '中性': '中性',
  '深情': '深情',
  '愉悦': '开心'
};

// 定义语言分类
const LANGUAGE_CATEGORIES = [
  { id: 'american', name: '美式英语', keywords: ['美式英语', 'american'] },
  { id: 'british', name: '英式英语', keywords: ['英式英语', 'british'] },
  { id: 'australian', name: '澳洲英语', keywords: ['澳洲英语', 'australian'] },
  { id: 'japanese', name: '日语', keywords: ['日语', 'japanese'] },
  { id: 'spanish', name: '西语', keywords: ['西语', 'spanish'] }  // 修改为"西语"以匹配CSV
];

export function VoiceSelector({ selectedVoice, onSelect, onClose }: VoiceSelectorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('american');
  const [voicesInLanguage, setVoicesInLanguage] = useState<VoiceInfo[]>([]);

  // 加载音色数据
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await loadVoicesFromCSV();
        // 默认选择美式英语
        const defaultLang = LANGUAGE_CATEGORIES[0];
        setSelectedLanguage(defaultLang.id);
        const voices = getVoicesByLanguageWithEmotionFirst(defaultLang.name);
        setVoicesInLanguage(voices);
      } catch (error) {
        console.error('加载音色数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // 当语言改变时更新音色列表
  useEffect(() => {
    if (!isLoading && selectedLanguage) {
      const langConfig = LANGUAGE_CATEGORIES.find(lang => lang.id === selectedLanguage);
      if (langConfig) {
        const voices = getVoicesByLanguageWithEmotionFirst(langConfig.name);
        setVoicesInLanguage(voices);
      }
    }
  }, [selectedLanguage, isLoading]);

  // 获取性别标签颜色
  const getGenderColor = (gender: 'male' | 'female') => {
    return gender === 'male' 
      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
      : 'bg-pink-500/20 text-pink-300 border-pink-500/30';
  };

  return (
    <div className="p-2.5 w-[600px] max-w-[90vw] bg-gray-900/95 backdrop-blur-xl rounded-lg border border-gray-800 shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-white">选择语音音色</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-gray-400 hover:text-white h-5 w-5"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      
      {/* 加载状态 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="ml-2 text-xs text-gray-400">加载音色数据中...</span>
        </div>
      ) : (
        <>
          {/* 语言选择 - 更紧凑 */}
          <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-hide">
            {LANGUAGE_CATEGORIES.map(lang => (
          <button
            key={lang.id}
            onClick={() => setSelectedLanguage(lang.id)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap",
              selectedLanguage === lang.id
                ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                : "hover:bg-white/5 text-gray-400 hover:text-white border border-transparent"
            )}
          >
            <span className="scale-75"><Globe className="w-3.5 h-3.5" /></span>
            <span>{lang.name}</span>
          </button>
        ))}
      </div>
      
      
      {/* 音色列表 - 更紧凑的3列布局 */}
      <ScrollArea className="h-[280px] pr-2">
        <div key={selectedLanguage} className="grid grid-cols-3 gap-1.5">
          {voicesInLanguage.map((voice, index) => {
            const voiceInfo = getVoiceInfo(voice.id);
            if (!voiceInfo) return null;
            
            const isSelected = selectedVoice === voice.id;
            const hasEmotions = voiceInfo.emotions && voiceInfo.emotions.length > 0;
            
            return (
              <div
                key={voice.uniqueKey || `${selectedLanguage}-${index}`}
                className={cn(
                  "p-2 rounded-md cursor-pointer transition-all duration-200 border relative overflow-hidden",
                  isSelected
                    ? hasEmotions 
                      ? "bg-gradient-to-br from-purple-600/30 via-pink-600/30 to-blue-600/30 border-purple-400/50"
                      : "bg-blue-600/20 border-blue-500/30"
                    : hasEmotions
                      ? "bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20 border-purple-700/30 hover:from-purple-800/30 hover:via-pink-800/30 hover:to-blue-800/30 hover:border-purple-600/40"
                      : "hover:bg-white/5 border-gray-800 hover:border-gray-700"
                )}
                onClick={() => onSelect(voice.id)}
              >
                <div className="flex items-start justify-between mb-1">
                  <h4 className="text-[10px] font-medium text-white leading-tight flex-1">
                    {(() => {
                      // 处理多语言音色名称
                      const name = voiceInfo.name;
                      if (name.includes('/')) {
                        // 根据当前语言分类显示对应名称
                        const parts = name.split('/');
                        if (selectedLanguage === 'japanese' && parts[0]) {
                          return parts[0].trim(); // 显示日语名称
                        } else if (selectedLanguage === 'spanish' && parts[1]) {
                          // 处理西语名称中的 "or" 选项，只取第一个
                          const spanishName = parts[1].trim();
                          if (spanishName.includes(' or ')) {
                            return spanishName.split(' or ')[0].trim();
                          }
                          return spanishName;
                        }
                      }
                      return name;
                    })()}
                  </h4>
                  {isSelected && (
                    <CheckCircle className="h-2.5 w-2.5 text-blue-500 flex-shrink-0 ml-1" />
                  )}
                </div>
                
                {/* 只显示语言和性别信息，不重复名字 */}
                {(voiceInfo.language || voiceInfo.gender) && (
                  <p className="text-[9px] text-gray-400 leading-tight mb-1">
                    {[
                      voiceInfo.language,
                      voiceInfo.gender === 'male' ? '男声' : voiceInfo.gender === 'female' ? '女声' : ''
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
                
                {/* 显示所有支持的情感 - 可换行 */}
                {voiceInfo.emotions && voiceInfo.emotions.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {voiceInfo.emotions.map(emotion => (
                      <Badge 
                        key={emotion} 
                        variant="secondary" 
                        className="text-[8px] px-1 py-0 h-3.5 bg-violet-500/10 text-violet-300 border-violet-500/20"
                      >
                        {emotionLabels[emotion] || emotion}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* 显示口音信息 - 更紧凑 */}
                {voiceInfo.accent && (
                  <Badge 
                    variant="outline" 
                    className="text-[8px] mt-1 px-1 py-0 h-3.5 bg-orange-500/10 text-orange-300 border-orange-500/20"
                  >
                    {voiceInfo.accent}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
        </>
      )}
    </div>
  );
}