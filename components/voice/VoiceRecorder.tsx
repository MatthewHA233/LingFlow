import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  onRecordingStart?: () => void
  onRecordingStop?: () => void
}

export function VoiceRecorder({ 
  onRecordingComplete, 
  onRecordingStart, 
  onRecordingStop 
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      setIsPreparing(true)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      })
      
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        onRecordingComplete(audioBlob)
        
        // 清理
        stream.getTracks().forEach(track => track.stop())
        chunksRef.current = []
      }
      
      mediaRecorder.start()
      setIsRecording(true)
      setIsPreparing(false)
      onRecordingStart?.()
    } catch (error) {
      console.error('无法启动录音:', error)
      setIsPreparing(false)
    }
  }, [onRecordingComplete, onRecordingStart])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      onRecordingStop?.()
    }
  }, [isRecording, onRecordingStop])

  return (
    <div className="flex gap-2">
      {!isRecording ? (
        <Button
          onClick={startRecording}
          disabled={isPreparing}
          className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
        >
          {isPreparing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Mic className="w-4 h-4 mr-2" />
          )}
          {isPreparing ? '准备中...' : '开始录音'}
        </Button>
      ) : (
        <Button
          onClick={stopRecording}
          className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800"
        >
          <Square className="w-4 h-4 mr-2" />
          停止录音
        </Button>
      )}
    </div>
  )
}