import React, { useState, useMemo } from 'react';
import { CheckCircle, X, Mic, Sparkles, Globe, User, Volume2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getVoicesByCategory, getVoiceCategories, getVoiceInfo, VoiceInfo } from '@/types/tts';
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
  'happy': '开心',
  'sad': '悲伤',
  'angry': '愤怒',
  'surprised': '惊讶',
  'fear': '恐惧',
  'hate': '厌恶',
  'excited': '兴奋',
  'coldness': '冷漠',
  'neutral': '中性'
};

export function VoiceSelector({ selectedVoice, onSelect, onClose }: VoiceSelectorProps) {
  // 只保留指定的分类
  const categories = ['英文多情感', '日语西语', '多情感'];
  
  // 默认选择英文多情感分类
  const [selectedCategory, setSelectedCategory] = useState('英文多情感');

  // 获取当前分类下的音色
  const voicesInCategory = useMemo(() => {
    return getVoicesByCategory(selectedCategory);
  }, [selectedCategory]);

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
      
      {/* 分类选择 - 更紧凑 */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap",
              selectedCategory === category
                ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                : "hover:bg-white/5 text-gray-400 hover:text-white border border-transparent"
            )}
          >
            <span className="scale-75">{categoryIcons[category]}</span>
            <span>{category}</span>
          </button>
        ))}
      </div>
      
      {/* 音色列表 - 更紧凑的3列布局 */}
      <ScrollArea className="h-[280px] pr-2">
        <div className="grid grid-cols-3 gap-1.5">
          {voicesInCategory.map(voice => {
            const voiceInfo = getVoiceInfo(voice.id);
            if (!voiceInfo) return null;
            
            const isSelected = selectedVoice === voice.id;
            
            return (
              <div
                key={voice.id}
                className={cn(
                  "p-2 rounded-md cursor-pointer transition-all duration-200 border",
                  isSelected
                    ? "bg-blue-600/20 border-blue-500/30"
                    : "hover:bg-white/5 border-gray-800 hover:border-gray-700"
                )}
                onClick={() => onSelect(voice.id)}
              >
                <div className="flex items-start justify-between mb-1">
                  <h4 className="text-[10px] font-medium text-white leading-tight flex-1 pr-1">
                    {voiceInfo.name}
                  </h4>
                  <div className="flex items-center gap-1">
                    <Badge 
                      variant="outline" 
                      className={cn("text-[8px] px-1 py-0 h-3.5", getGenderColor(voiceInfo.gender))}
                    >
                      {voiceInfo.gender === 'male' ? '男' : '女'}
                    </Badge>
                    {isSelected && (
                      <CheckCircle className="h-2.5 w-2.5 text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
                
                <p className="text-[9px] text-gray-400 leading-tight mb-1 line-clamp-2">
                  {voiceInfo.description}
                </p>
                
                {/* 显示支持的情感 - 更紧凑 */}
                {voiceInfo.emotions && voiceInfo.emotions.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {voiceInfo.emotions.slice(0, 2).map(emotion => (
                      <Badge 
                        key={emotion} 
                        variant="secondary" 
                        className="text-[8px] px-1 py-0 h-3.5 bg-violet-500/10 text-violet-300 border-violet-500/20"
                      >
                        {emotionLabels[emotion] || emotion}
                      </Badge>
                    ))}
                    {voiceInfo.emotions.length > 2 && (
                      <Badge 
                        variant="secondary" 
                        className="text-[8px] px-1 py-0 h-3.5 bg-gray-700/50 text-gray-400"
                      >
                        +{voiceInfo.emotions.length - 2}
                      </Badge>
                    )}
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
    </div>
  );
}