import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CheckCircle, X, Mic, Sparkles, Globe, User, Volume2, Zap, Loader2, Play, Pause, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getVoicesByCategory, getVoiceCategories, getVoiceInfo, VoiceInfo, loadVoicesFromCSV, VoiceCategory, getVoicesByLanguageWithEmotionFirst } from '@/types/tts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const [playingVoice, setPlayingVoice] = useState<string>('');
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [demoText, setDemoText] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number; isAbove: boolean } | null>(null);
  const animationFrameRef = useRef<number>(0);
  const selectorRef = useRef<HTMLDivElement>(null);

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

  // 获取头像颜色和图标
  const getAvatarInfo = (voiceInfo: VoiceInfo) => {
    const isMale = voiceInfo.gender === 'male';
    
    const bgColor = isMale ? 'bg-blue-500/20' : 'bg-pink-500/20';
    const textColor = isMale ? 'text-blue-300' : 'text-pink-300';
    const initial = isMale ? '男' : '女';
    
    return { bgColor, textColor, initial };
  };

  // 获取试听文本
  const getDemoText = (voiceInfo: VoiceInfo, demoIndex: number = 0) => {
    if (!voiceInfo.demoText) return null;
    
    // 如果是数组格式（双语音色）
    if (Array.isArray(voiceInfo.demoText)) {
      if (demoIndex < voiceInfo.demoText.length) {
        return voiceInfo.demoText[demoIndex].text;
      }
      // 如果索引超出，返回第一个
      return voiceInfo.demoText[0]?.text || null;
    }
    
    // 单一文本
    return voiceInfo.demoText;
  };

  // 处理试听播放
  const handlePlayDemo = async (e: React.MouseEvent, voiceInfo: VoiceInfo, demoIndex: number = 0) => {
    e.stopPropagation(); // 阻止触发选择事件
    
    const playKey = `${voiceInfo.id}-${demoIndex}`;
    
    // 如果点击的是正在播放的音色，停止播放
    if (playingVoice === playKey) {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }
      setPlayingVoice('');
      setDemoText('');
      setTooltipPosition(null);
      return;
    }
    
    // 停止之前的音频播放
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    // 构建OSS CDN URL
    const OSS_DOMAIN = 'https://assets.lingflow.cn';
    let demoUrl: string;
    let fileName: string;
    
    // 根据试听文本获取对应的名称
    let demoName: string = voiceInfo.name;
    if (Array.isArray(voiceInfo.demoText) && voiceInfo.demoText[demoIndex]) {
      demoName = voiceInfo.demoText[demoIndex].name;
    }
    
    // 检查是否为日西语等特殊音色（name中包含日文或特殊字符）
    if (demoName && (
      /[\u3040-\u309f\u30a0-\u30ff]/.test(demoName) || // 日文
      demoName.includes('Javier') || 
      demoName.includes('Álvaro') ||
      demoName.includes('Roberto') ||
      demoName.includes('Esmeralda')
    )) {
      // 日西语音色：直接使用demo name作为文件名
      fileName = `${voiceInfo.id}_${demoName}`;
    } else if (Array.isArray(voiceInfo.demoText) && voiceInfo.demoText.length > 1) {
      // 中英双语音色：直接使用demo的名称
      fileName = `${voiceInfo.id}_${demoName}`;
    } else {
      // 单语音色：只用音色名
      fileName = `${voiceInfo.id}_${voiceInfo.name}`;
    }
    
    // 处理文件名（移除特殊字符）
    fileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
    
    // 判断文件扩展名（日西语音色可能是wav，通过demoUrls判断）
    let ext = '.mp3';
    if (voiceInfo.demoUrls && voiceInfo.demoUrls[demoIndex]) {
      const demoInfo = voiceInfo.demoUrls[demoIndex];
      ext = demoInfo.url && demoInfo.url.includes('.wav') ? '.wav' : '.mp3';
    } else if (demoName && (
      /[\u3040-\u309f\u30a0-\u30ff]/.test(demoName) ||
      demoName.includes('Javier') || 
      demoName.includes('Álvaro') ||
      demoName.includes('Roberto') ||
      demoName.includes('Esmeralda')
    )) {
      // 日西语音色通常是wav
      ext = '.wav';
    }
    
    // 构建完整URL
    demoUrl = `${OSS_DOMAIN}/tts_voice_demos/${fileName}${ext}`;
    
    // 设置新的播放状态和试听文本
    setPlayingVoice(playKey);
    const text = getDemoText(voiceInfo, demoIndex);
    if (text) {
      setDemoText(text);
      
      // 计算气泡位置
      const button = e.currentTarget as HTMLElement;
      const buttonRect = button.getBoundingClientRect();
      const selectorRect = selectorRef.current?.getBoundingClientRect();
      
      if (selectorRect) {
        // 计算气泡的基础x位置（相对于选择器的中心）
        let x = buttonRect.left + buttonRect.width / 2 - selectorRect.left - selectorRect.width / 2;
        
        // 计算气泡的预期位置和宽度
        const tooltipMaxWidth = 320; // max-w-xs 的宽度
        const viewportWidth = window.innerWidth;
        const tooltipLeft = selectorRect.left + selectorRect.width / 2 + x - tooltipMaxWidth / 2;
        const tooltipRight = tooltipLeft + tooltipMaxWidth;
        
        // 如果气泡右边超出视口，调整x位置
        const rightMargin = 20; // 右侧保留的边距
        if (tooltipRight > viewportWidth - rightMargin) {
          const overflow = tooltipRight - (viewportWidth - rightMargin);
          x -= overflow;
        }
        
        // 如果气泡左边超出视口，调整x位置
        const leftMargin = 20; // 左侧保留的边距
        if (tooltipLeft < leftMargin) {
          const overflow = leftMargin - tooltipLeft;
          x += overflow;
        }
        
        // 判断选择器在视口的位置
        const viewportHeight = window.innerHeight;
        const selectorBottom = selectorRect.bottom;
        
        // 如果选择器底部距离视口底部小于300px，气泡显示在上方
        // 这样可以确保有足够空间显示气泡
        const spaceBelow = viewportHeight - selectorBottom;
        const isAbove = spaceBelow < 300;
        
        setTooltipPosition({ x, y: 0, isAbove });
      }
    }
    
    try {
      // 创建音频对象并播放
      const audio = new Audio(demoUrl);
      
      audio.onended = () => {
        setPlayingVoice('');
        setCurrentAudio(null);
        setDemoText('');
        setAudioLevel(0);
        setTooltipPosition(null);
        stopAudioAnalysis();
      };
      
      audio.onerror = () => {
        console.warn(`音色 ${voiceInfo.name} 的试听音频无法播放: ${demoUrl}`);
        setPlayingVoice('');
        setCurrentAudio(null);
        setDemoText('');
        setAudioLevel(0);
        setTooltipPosition(null);
        stopAudioAnalysis();
      };
      
      setCurrentAudio(audio);
      await audio.play();
      
      // 设置音频分析
      setupAudioAnalysis(audio);
      
    } catch (error) {
      console.warn(`播放音色 ${voiceInfo.name} 试听失败:`, error);
      setPlayingVoice('');
      setCurrentAudio(null);
      setDemoText('');
      setAudioLevel(0);
      setTooltipPosition(null);
      stopAudioAnalysis();
    }
  };

  // 设置音频分析（使用简单的模拟动画，避免CORS问题）
  const setupAudioAnalysis = (audio: HTMLAudioElement) => {
    // 使用简单的随机波动来模拟音频波形
    let isPlaying = true;
    
    const animate = () => {
      if (!isPlaying) return;
      
      // 生成随机波动，模拟音频波形
      const baseLevel = 0.3;
      const variation = Math.random() * 0.5;
      const smoothedLevel = baseLevel + variation;
      
      setAudioLevel(smoothedLevel);
      
      animationFrameRef.current = requestAnimationFrame(() => {
        setTimeout(animate, 100); // 每100ms更新一次，创造更平滑的效果
      });
    };
    
    animate();
    
    // 监听音频结束
    audio.addEventListener('ended', () => {
      isPlaying = false;
    });
    
    audio.addEventListener('pause', () => {
      isPlaying = false;
    });
  };

  // 停止音频分析
  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    setAudioLevel(0);
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopAudioAnalysis();
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    };
  }, [currentAudio]);

  // 处理关闭事件
  const handleClose = () => {
    // 停止当前播放的音频
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    setPlayingVoice('');
    setDemoText('');
    setTooltipPosition(null);
    stopAudioAnalysis();
    
    // 调用外部的关闭函数
    onClose();
  };

  return (
    <div ref={selectorRef} className="p-2.5 w-[600px] max-w-[90vw] bg-gray-900/95 backdrop-blur-xl rounded-lg border border-gray-800 shadow-2xl relative">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-white">选择语音音色</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="h-5 w-5 text-gray-400 hover:text-white transition-all duration-200 hover:bg-gradient-to-r hover:from-red-500/20 hover:to-pink-500/20 hover:border hover:border-red-500/30"
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
            const isMale = voiceInfo.gender === 'male';
            
            return (
              <div
                key={voice.uniqueKey || `${selectedLanguage}-${index}`}
                className={cn(
                  "p-2 rounded-md cursor-pointer transition-all duration-200 border-2 relative overflow-hidden",
                  // 多情感音色的特殊样式
                  hasEmotions ? (
                    isSelected
                      ? "bg-gradient-to-br from-purple-600/30 via-pink-600/30 to-blue-600/30 border-purple-400"
                      : "bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20 border-purple-700/30 hover:from-purple-800/30 hover:via-pink-800/30 hover:to-blue-800/30 hover:border-purple-600/40"
                  ) : (
                    // 普通音色根据性别调整边框颜色
                    isSelected
                      ? isMale
                        ? "bg-blue-600/10 border-blue-500"
                        : "bg-pink-600/10 border-pink-500"
                      : isMale
                        ? "hover:bg-blue-500/5 border-blue-700/40 hover:border-blue-500/60"
                        : "hover:bg-pink-500/5 border-pink-700/40 hover:border-pink-500/60"
                  )
                )}
                onClick={() => onSelect(voice.id)}
              >
                {/* 试听按钮放在右上角 */}
                <div className="absolute top-1 right-1">
                  {/* 试听按钮 - 根据是否有试听文本来判断 */}
                  {voiceInfo.demoText && (
                    <>
                      {Array.isArray(voiceInfo.demoText) && voiceInfo.demoText.length > 1 && (selectedLanguage === 'american' || selectedLanguage === 'british' || selectedLanguage === 'australian') ? (
                        // 双语音色在英语分类下：显示两个按钮
                        <div className="flex gap-1">
                          {voiceInfo.demoText.slice(0, 2).map((demo, idx) => {
                            const isPlaying = playingVoice === `${voice.id}-${idx}`;
                            const isChineseDemo = /[\u4e00-\u9fa5]/.test(demo.name);
                            return (
                              <TooltipProvider key={idx} delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={cn(
                                        "h-7 w-7 p-0 hover:bg-white/10 relative transition-all",
                                        !isChineseDemo && (isMale ? "border border-blue-600/50" : "border border-pink-600/50"),
                                        isPlaying && (isMale ? "bg-blue-500/10" : "bg-pink-500/10"),
                                        isPlaying && "animate-pulse"
                                      )}
                                      onClick={(e) => handlePlayDemo(e, voiceInfo, idx)}
                                    >
                                      <div className={cn(
                                        "transition-transform duration-200",
                                        isPlaying && "scale-110"
                                      )}>
                                        {isPlaying ? (
                                          <Pause className={cn(
                                            "h-4 w-4",
                                            isChineseDemo ? "text-gray-100" : (isMale ? "text-blue-400" : "text-pink-400")
                                          )} />
                                        ) : (
                                          <Play className={cn(
                                            "h-4 w-4 transition-colors",
                                            isChineseDemo ? "text-gray-100" : (isMale ? "text-blue-400" : "text-pink-400")
                                          )} />
                                        )}
                                      </div>
                                      {/* 小标签区分中英文 */}
                                      <span className={cn(
                                        "absolute -bottom-1 -right-1 text-[7px] font-bold px-0.5",
                                        isChineseDemo 
                                          ? "text-gray-400" 
                                          : (isMale ? "text-blue-400" : "text-pink-400")
                                      )}>
                                        {isChineseDemo ? "中" : "英"}
                                      </span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent 
                                    side="top" 
                                    className="bg-gray-800/95 backdrop-blur-sm border-gray-700 text-gray-200"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Volume2 className="h-3.5 w-3.5 text-purple-400" />
                                      <span className="text-xs font-medium">{demo.name} 试听</span>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      ) : (
                        // 单语音色或非英语分类下的双语音色：显示一个按钮
                        (() => {
                          // 计算当前语言分类应该使用的 demoIndex
                          let demoIndex = 0;
                          if (Array.isArray(voiceInfo.demoText) && voiceInfo.demoText.length > 1) {
                            if (selectedLanguage === 'japanese') {
                              demoIndex = 0;
                            } else if (selectedLanguage === 'spanish') {
                              demoIndex = 1;
                            }
                          }
                          const playKey = `${voice.id}-${demoIndex}`;
                          const isPlaying = playingVoice === playKey;
                          
                          // 获取要显示的音色名称
                          let displayName = voiceInfo.name;
                          if (Array.isArray(voiceInfo.demoText) && voiceInfo.demoText[demoIndex]) {
                            displayName = voiceInfo.demoText[demoIndex].name;
                          }
                          
                          return (
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "h-7 w-7 p-0 hover:bg-white/10 transition-all",
                                      isPlaying && (isMale ? "bg-blue-500/10" : "bg-pink-500/10"),
                                      isPlaying && "animate-pulse"
                                    )}
                                    onClick={(e) => handlePlayDemo(e, voiceInfo, demoIndex)}
                                  >
                                    <div className={cn(
                                      "transition-transform duration-200",
                                      isPlaying && "scale-110"
                                    )}>
                                      {isPlaying ? (
                                        <Pause className={cn(
                                          "h-4 w-4",
                                          isMale ? "text-blue-400" : "text-pink-400"
                                        )} />
                                      ) : (
                                        <Play className={cn(
                                          "h-4 w-4",
                                          isMale ? "text-blue-400" : "text-pink-400"
                                        )} />
                                      )}
                                    </div>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent 
                                  side="top" 
                                  className="bg-gray-800/95 backdrop-blur-sm border-gray-700 text-gray-200"
                                >
                                  <div className="flex items-center gap-2">
                                    <Volume2 className="h-3.5 w-3.5 text-purple-400" />
                                    <span className="text-xs font-medium">{displayName} 试听</span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()
                      )}
                    </>
                  )}
                </div>
                
                <div className="flex items-start justify-between mb-1 pr-12">
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
                </div>
                
                {/* 只显示语言信息 */}
                {voiceInfo.language && (
                  <p className="text-[9px] text-gray-400 leading-tight mb-1">
                    {voiceInfo.language}
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
                
                {/* 右下角图标区域 */}
                <div className="absolute bottom-1 right-1 flex items-center gap-1">
                  {/* 选中标记在左 */}
                  {isSelected && (
                    <CheckCircle className={cn(
                      "h-3 w-3",
                      isMale ? "text-blue-500" : "text-pink-500"
                    )} />
                  )}
                  {/* 性别符号在右 */}
                  {isMale ? (
                    <svg className="h-3.5 w-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="10" cy="14" r="5" stroke="currentColor" strokeWidth="2"/>
                      <path d="M13.5 10.5L18 6M18 6H14M18 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5 text-pink-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="9" r="5" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 14V19M12 19H9M12 19H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
        </>
      )}
      
      {/* 试听文本提示框 - 只有当CSV中有试听文本时才显示 */}
      {demoText && playingVoice && tooltipPosition && (
        <div 
          className={cn(
            "absolute left-1/2 z-50 animate-in fade-in duration-200",
            tooltipPosition.isAbove 
              ? "bottom-full mb-2 slide-in-from-bottom-2" 
              : "top-full mt-2 slide-in-from-top-2"
          )}
          style={{ 
            transform: `translateX(calc(-50% + ${tooltipPosition.x}px))`,
          }}>
          <div className="bg-gray-800/95 backdrop-blur-xl border border-gray-700 rounded-lg px-4 py-3 shadow-xl max-w-xs">
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <Volume2 className="w-5 h-5 text-purple-400 relative z-10" />
                {/* 三层紫色光圈动画效果 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span 
                    className="absolute inline-flex rounded-full bg-purple-400 transition-all duration-100"
                    style={{ 
                      width: `${20 + audioLevel * 30}px`,
                      height: `${20 + audioLevel * 30}px`,
                      opacity: 0.3 - audioLevel * 0.1
                    }}
                  ></span>
                  <span 
                    className="absolute inline-flex rounded-full bg-purple-400 transition-all duration-150"
                    style={{ 
                      width: `${16 + audioLevel * 20}px`,
                      height: `${16 + audioLevel * 20}px`,
                      opacity: 0.4 - audioLevel * 0.15
                    }}
                  ></span>
                  <span 
                    className="absolute inline-flex rounded-full bg-purple-500 transition-all duration-75"
                    style={{ 
                      width: `${12 + audioLevel * 12}px`,
                      height: `${12 + audioLevel * 12}px`,
                      opacity: 0.5 - audioLevel * 0.2
                    }}
                  ></span>
                </div>
              </div>
              <p className="text-sm text-gray-200 leading-relaxed pt-0.5">
                {demoText}
              </p>
            </div>
            {/* 箭头 - 根据位置显示在上方或下方 */}
            {tooltipPosition.isAbove ? (
              // 箭头在底部（指向下方）
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-700"></div>
              </div>
            ) : (
              // 箭头在顶部（指向上方）
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-gray-700"></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}