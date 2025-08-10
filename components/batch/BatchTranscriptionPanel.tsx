import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface AudioFile {
  id: string
  name: string
  file: File
  status: 'processing' | 'ready' | 'error'
  error?: string
  transcription?: string
  audioUrl?: string
  duration?: number
}

interface BatchTranscriptionPanelProps {
  audioFiles: AudioFile[]
  onBack: () => void
}

export function BatchTranscriptionPanel({ audioFiles, onBack }: BatchTranscriptionPanelProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedCount, setProcessedCount] = useState(0)

  const startBatchProcessing = async () => {
    setIsProcessing(true)
    setProcessedCount(0)
    
    // 模拟批量处理
    for (let i = 0; i < audioFiles.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setProcessedCount(i + 1)
    }
    
    setIsProcessing(false)
  }

  const progress = audioFiles.length > 0 
    ? (processedCount / audioFiles.length) * 100 
    : 0

  return (
    <Card className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">批量转写</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">处理进度</span>
            <span className="text-sm text-blue-400">
              {processedCount} / {audioFiles.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {audioFiles.map((file, index) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-300">{file.name}</span>
                  {index < processedCount && (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  )}
                  {index === processedCount && isProcessing && (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  )}
                </div>
                <Badge
                  variant={
                    index < processedCount 
                      ? "default" 
                      : index === processedCount && isProcessing 
                        ? "secondary" 
                        : "outline"
                  }
                  className="text-xs"
                >
                  {index < processedCount 
                    ? "完成" 
                    : index === processedCount && isProcessing 
                      ? "处理中" 
                      : "等待"}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Button
          onClick={startBatchProcessing}
          disabled={isProcessing || audioFiles.length === 0}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              处理中...
            </>
          ) : (
            '开始批量转写'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}