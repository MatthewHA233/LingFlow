/**
 * TTS生成组件
 * 简单直接的TTS功能实现
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Volume2, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';

interface TTSGeneratorProps {
  text: string;
  bookId: string;
  onComplete?: (result: any) => void;
  onCancel?: () => void;
}

const VOICE_OPTIONS = [
  { value: 'en_female_amanda_mars_bigtts', label: 'Amanda (美式)' },
  { value: 'en_male_adam_mars_bigtts', label: 'Adam (美式)' },
  { value: 'en_female_anna_mars_bigtts', label: 'Anna (英式)' },
  { value: 'en_male_oliver_mars_bigtts', label: 'Oliver (英式)' },
];

export function TTSGenerator({ text, bookId, onComplete, onCancel }: TTSGeneratorProps) {
  const [voiceType, setVoiceType] = useState(VOICE_OPTIONS[0].value);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    let toastId;
    
    try {
      toastId = toast.loading('正在生成TTS音频...');
      
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        throw new Error('请先登录');
      }
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text,
          voiceType,
          bookId,
          speedRatio: 1.0
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'TTS生成失败');
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('TTS音频生成成功！', { id: toastId });
        
        if (onComplete) {
          onComplete({
            success: true,
            audioUrl: data.audioUrl,
            speechId: data.speechId,
            duration: data.data?.duration
          });
        }
      }
    } catch (error) {
      console.error('TTS生成失败:', error);
      toast.error(`TTS生成失败: ${(error as Error).message}`, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-violet-200/50 dark:border-violet-800/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Volume2 className="w-5 h-5 text-violet-600" />
          TTS 语音生成
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 文本预览 */}
        <div className="p-3 rounded-lg bg-muted/50 border border-violet-200 dark:border-violet-800">
          <p className="text-sm font-medium mb-1 text-violet-600">选中的文本：</p>
          <p className="text-sm text-muted-foreground line-clamp-3">{text}</p>
          <p className="text-xs text-violet-500/70 mt-2">{text.length} 字符</p>
        </div>
        
        {/* 语音选择 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">选择英语语音</Label>
          <div className="grid grid-cols-2 gap-2">
            {VOICE_OPTIONS.map(voice => (
              <button
                key={voice.value}
                onClick={() => setVoiceType(voice.value)}
                className={cn(
                  "p-2 rounded-lg border-2 text-sm transition-all",
                  voiceType === voice.value
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                    : "border-border hover:border-violet-300"
                )}
              >
                {voice.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                生成音频
              </>
            )}
          </Button>
          
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isGenerating}
            >
              取消
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}