import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Volume2, ChevronDown } from 'lucide-react'
import { VoiceSelector } from './VoiceSelector'
import { getVoiceInfo, emotionLabels } from '@/types/tts'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface TTSSettingsPanelProps {
  // 音色相关
  voiceType: string
  onVoiceChange: (voiceId: string) => void
  showVoiceSelector: boolean
  onVoiceSelectorToggle: (open: boolean) => void
  
  // 语速
  speedRatio: number
  onSpeedChange: (speed: number) => void
  
  // 情感相关
  enableEmotion: boolean
  onEnableEmotionChange: (enable: boolean) => void
  emotion: string
  onEmotionChange: (emotion: string) => void
  emotionScale: number
  onEmotionScaleChange: (scale: number) => void
}

export function TTSSettingsPanel({
  voiceType,
  onVoiceChange,
  showVoiceSelector,
  onVoiceSelectorToggle,
  speedRatio,
  onSpeedChange,
  enableEmotion,
  onEnableEmotionChange,
  emotion,
  onEmotionChange,
  emotionScale,
  onEmotionScaleChange,
}: TTSSettingsPanelProps) {
  const voiceInfo = getVoiceInfo(voiceType)
  const hasEmotions = voiceInfo?.emotions && voiceInfo.emotions.length > 0

  return (
    <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-sm">
      <CardContent className="p-2 space-y-2">
        {/* 语音选择 - 使用新的选择器 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-300">语音音色</Label>
          <Popover open={showVoiceSelector} onOpenChange={onVoiceSelectorToggle}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between h-9 text-xs border-gray-600 bg-gray-700/50 hover:bg-gray-700 text-gray-200 hover:text-white"
              >
                <span className="flex items-center gap-2 text-gray-200">
                  <Volume2 className="w-3.5 h-3.5 text-gray-300" />
                  {voiceInfo?.name || '选择音色'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-50 text-gray-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-transparent border-0" align="end" sideOffset={5}>
              <VoiceSelector
                selectedVoice={voiceType}
                onSelect={(voiceId) => {
                  onVoiceChange(voiceId)
                  onVoiceSelectorToggle(false)
                  // 如果选择的是多情感音色，自动开启情感并设置默认值
                  const newVoiceInfo = getVoiceInfo(voiceId)
                  if (newVoiceInfo?.emotions && newVoiceInfo.emotions.length > 0) {
                    onEnableEmotionChange(true)
                    onEmotionScaleChange(5)
                    // 设置默认情感为第一个
                    if (newVoiceInfo.emotions.length > 0) {
                      onEmotionChange(newVoiceInfo.emotions[0])
                    }
                  }
                }}
                onClose={() => onVoiceSelectorToggle(false)}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 语速调节 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-medium text-gray-300">语速</Label>
            <span className="text-[10px] text-gray-500">{speedRatio.toFixed(1)}x</span>
          </div>
          <Slider
            value={[speedRatio]}
            onValueChange={([value]) => onSpeedChange(value)}
            min={0.5}
            max={2.0}
            step={0.1}
            className="h-0.5"
          />
        </div>

        {/* 情感设置 - 如果支持 */}
        {hasEmotions && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-300">情感表达</Label>
              <Switch
                checked={enableEmotion}
                onCheckedChange={onEnableEmotionChange}
                className="h-4 w-8"
              />
            </div>
            
            {enableEmotion && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Select value={emotion} onValueChange={onEmotionChange}>
                  <SelectTrigger className="h-8 text-xs border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-pink-900/20 hover:from-purple-800/30 hover:to-pink-800/30 transition-all">
                    <SelectValue placeholder="选择情感表达" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900/95 backdrop-blur-xl border-purple-500/30">
                    {voiceInfo.emotions!.map(emotion => (
                      <SelectItem 
                        key={emotion} 
                        value={emotion}
                        className="text-xs text-gray-200 hover:bg-purple-500/20 hover:text-white focus:bg-purple-500/30 focus:text-white data-[highlighted]:text-white cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
                          <span>{emotionLabels[emotion] || emotion}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* 情感强度 */}
                <div className="space-y-1.5 p-2 rounded-lg bg-gradient-to-r from-purple-900/10 to-pink-900/10 border border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-purple-300 font-medium">情感强度</Label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full transition-all",
                            level <= emotionScale
                              ? "bg-gradient-to-r from-purple-400 to-pink-400"
                              : "bg-gray-600"
                          )}
                        />
                      ))}
                      <span className="text-[10px] text-purple-300 ml-1 font-medium">{emotionScale}</span>
                    </div>
                  </div>
                  <Slider
                    value={[emotionScale]}
                    onValueChange={([value]) => onEmotionScaleChange(value)}
                    min={1}
                    max={5}
                    step={1}
                    className="h-1 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-purple-400 [&_[role=slider]]:to-pink-400 [&_[role=slider]]:border-purple-500/50 [&_[role=slider]]:shadow-lg [&_[role=slider]]:shadow-purple-500/20"
                  />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}