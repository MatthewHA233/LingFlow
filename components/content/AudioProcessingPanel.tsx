'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Play, Pause, Check, X, Loader2, Volume2, Sparkles, Target, Zap, Music, Clock, FileAudio, RefreshCw, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase-client'
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Confetti } from '@/components/ui/confetti'
import AudioProcessingOrb from '@/components/ui/audio-processing-orb'

// 测试模式开关 - 只能在代码中开启
const DEBUG_MODE = false

interface AudioProcessingPanelProps {
  bookId: string
  contextBlocks: any[]
  onProcessingComplete: () => void
}

type ProcessingStage = 
  | 'idle'
  | 'uploading'
  | 'uploaded'
  | 'selecting_start'
  | 'selecting_end'
  | 'processing'
  | 'completed'
  | 'error'

interface AudioRecord {
  id: string
  task_id: string
  audio_url: string
  status: string
  created_at: string
  filename?: string
  duration?: number
  name?: string // 音频显示名称
}

interface SelectedRange {
  startBlockId: string
  endBlockId: string
  startBlockContent: string
  endBlockContent: string
}

// 音频矩形组件
const AudioRectangle = ({ 
  audio, 
  isSelected, 
  isPlaying, 
  onClick 
}: { 
  audio: AudioRecord
  isSelected: boolean
  isPlaying: boolean
  onClick: () => void 
}) => {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateStr: string) => {
    // 将UTC时间转换为中国时区时间（UTC+8）
    const utcDate = new Date(dateStr);
    const chinaTime = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
    
    return chinaTime.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai'
    });
  }

  return (
    <motion.div
      className={cn(
        "relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-300",
        "hover:shadow-md hover:shadow-primary/10",
        "group overflow-hidden",
        isSelected 
          ? "border-primary bg-primary/5 shadow-md shadow-primary/20" 
          : "border-border hover:border-primary/50 bg-card"
      )}
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* 背景渐变动画 */}
      <div className={cn(
        "absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300",
        "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
        isSelected && "opacity-100"
      )} />
      
      {/* 播放涟漪效果 */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            className="absolute inset-0 rounded-lg"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.8, 0.3, 0.8]
            }}
            exit={{ scale: 1, opacity: 0 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="absolute inset-0 rounded-lg border-2 border-primary/40" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 内容区域 */}
      <div className="relative z-10">
        {/* 顶部音频图标和信息 */}
        <div className="flex items-center gap-2 mb-2">
          <motion.div 
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
              isSelected 
                ? "bg-primary text-primary-foreground shadow-lg" 
                : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            )}
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
          >
            {isPlaying ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <FileAudio className="w-4 h-4" />
            )}
          </motion.div>
          
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">
              {audio.name || '未命名音频'}
            </div>
            <div className="text-[10px] text-muted-foreground">
               {formatDate(audio.created_at)}
            </div>
          </div>
        </div>
        
        {/* 底部状态和时长 */}
        <div className="flex items-center justify-between">
          <motion.span 
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-300",
              audio.status === 'completed' 
                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : audio.status === 'processing'
                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
            )}
            whileHover={{ scale: 1.05 }}
          >
            {audio.status === 'completed' ? '已完成' : 
             audio.status === 'processing' ? '处理中' : '待处理'}
          </motion.span>
          
          <div className="flex flex-col items-end text-[10px] text-muted-foreground">
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-0.5" />
              时长{formatDuration(audio.duration)}
            </div>
          </div>
        </div>
      </div>
      
      {/* 选中状态的光晕效果 */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function AudioProcessingPanel({ 
  bookId, 
  contextBlocks, 
  onProcessingComplete 
}: AudioProcessingPanelProps) {
  const [stage, setStage] = useState<ProcessingStage>('idle')
  const [selectedAudio, setSelectedAudio] = useState<AudioRecord | null>(null)
  const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(null)
  const [error, setError] = useState<string>('')
  const [progress, setProgress] = useState(0)
  const [audioRecords, setAudioRecords] = useState<AudioRecord[]>([])
  const [isLoadingAudios, setIsLoadingAudios] = useState(false)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  // 加载书籍的所有音频记录
  const loadAudioRecords = useCallback(async () => {
    setIsLoadingAudios(true)
    try {
      const { data, error } = await supabase
        .from('speech_results')
        .select('id, task_id, audio_url, status, created_at, duration, name')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setAudioRecords(data || [])
      
      // 如果有音频记录但没有选中任何音频，自动选择第一个
      if (data && data.length > 0 && !selectedAudio) {
        setSelectedAudio(data[0])
        setStage('uploaded')
      }
    } catch (error: any) {
      console.error('加载音频记录失败:', error)
      toast.error('加载音频记录失败')
    } finally {
      setIsLoadingAudios(false)
    }
  }, [bookId, selectedAudio])

  // 组件初始化时加载音频记录
  useEffect(() => {
    loadAudioRecords()
  }, [loadAudioRecords])

  // 监听音频上传完成事件，重新加载音频列表
  useEffect(() => {
    const handleAudioUploaded = () => {
      loadAudioRecords()
    }

    window.addEventListener('audio-uploaded', handleAudioUploaded)
    return () => {
      window.removeEventListener('audio-uploaded', handleAudioUploaded)
    }
  }, [loadAudioRecords])

  // 播放语音提示
  const playAudioPrompt = useCallback(async (promptType: 'START_SELECTION' | 'END_SELECTION' | 'PROCESSING', audioSegment?: { start: number, duration: number }) => {
    try {
      const promptMessages = {
        START_SELECTION: '请选择起始语境块',
        END_SELECTION: '请选择结束语境块', 
        PROCESSING: '开始处理音频对齐'
      }
      
      toast.info(promptMessages[promptType], {
        duration: 2000,
        position: 'top-center'
      })
      
      // 如果有音频片段且选择了音频，播放音频片段
      if (audioSegment && selectedAudio && audioRef.current) {
        // 先停止当前播放
        audioRef.current.pause()
        setPlayingAudioId(null)
        
        // 等待一小段时间确保音频停止
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // 设置新的播放位置和状态
        setPlayingAudioId(selectedAudio.id)
        audioRef.current.currentTime = audioSegment.start
        
        try {
          await audioRef.current.play()
          console.log(`🎵 播放音频片段: ${audioSegment.start}s - ${audioSegment.start + audioSegment.duration}s`)
          
          // 播放指定时长后停止
          setTimeout(() => {
            if (audioRef.current && playingAudioId === selectedAudio.id) {
              audioRef.current.pause()
              setPlayingAudioId(null)
              console.log('🔇 音频片段播放完成')
            }
          }, audioSegment.duration * 1000)
        } catch (playError) {
          console.warn('播放音频失败:', playError)
          setPlayingAudioId(null)
        }
      }
      
    } catch (error) {
      console.error('播放音频提示失败:', error)
    }
  }, [selectedAudio, playingAudioId])

  // 选择音频
  const handleAudioSelect = (audio: AudioRecord) => {
    setSelectedAudio(audio)
    setStage('uploaded')
    setSelectedRange(null) // 重置选择范围
    
    // 获取音频时长
    if (audio.audio_url && audioRef.current) {
      audioRef.current.src = audio.audio_url
      audioRef.current.onloadedmetadata = () => {
        // 可以在这里更新音频时长到数据库
      }
    }
  }

  // 开始选择语境块
  const startBlockSelection = async () => {
    if (!selectedAudio) return

    setStage('selecting_start')
    
    // 播放音频开始段落和语音提示
    await playAudioPrompt('START_SELECTION', { start: 0, duration: 10 })
    
    // 启用语境块选择模式
    window.dispatchEvent(new CustomEvent('enable-block-selection', {
      detail: { mode: 'start' }
    }))
  }

  // 处理语境块选择
  const handleBlockSelection = useCallback((blockId: string, blockContent: string) => {
    if (stage === 'selecting_start') {
      setSelectedRange(prev => ({
        ...prev,
        startBlockId: blockId,
        startBlockContent: blockContent
      } as SelectedRange))
      
      // 立即发送事件标记起始块为已选择
      window.dispatchEvent(new CustomEvent('mark-start-block-selected', {
        detail: { 
          startBlockId: blockId
        }
      }))
      
      // 切换到选择结束块
      setStage('selecting_end')
      
      // 立即播放音频结束段落
      const playEndSegment = async () => {
        if (selectedAudio && audioRef.current) {
          // 确保音频元数据已加载
          if (audioRef.current.readyState === 0) {
            // 如果元数据未加载，等待加载完成
            audioRef.current.onloadedmetadata = () => {
              const duration = audioRef.current?.duration || 0
              playAudioPrompt('END_SELECTION', { 
                start: Math.max(0, duration - 10), 
                duration: 10 
              })
            }
          } else {
            // 元数据已加载，直接播放
            const duration = audioRef.current.duration || 0
            await playAudioPrompt('END_SELECTION', { 
              start: Math.max(0, duration - 10), 
              duration: 10 
            })
          }
        }
      }
      
      playEndSegment()
      
      // 启用选择结束块模式
      window.dispatchEvent(new CustomEvent('enable-block-selection', {
        detail: { mode: 'end' }
      }))
      
    } else if (stage === 'selecting_end') {
      const newSelectedRange = {
        ...selectedRange!,
        endBlockId: blockId,
        endBlockContent: blockContent
      }
      setSelectedRange(newSelectedRange)
      
      // 停止当前播放
      if (audioRef.current) {
        audioRef.current.pause()
        setPlayingAudioId(null)
      }
      
      // 发送选择确认事件，让相关的语境块显示始/终标记
      window.dispatchEvent(new CustomEvent('selection-confirmed', {
        detail: { 
          startBlockId: newSelectedRange.startBlockId,
          endBlockId: newSelectedRange.endBlockId
        }
      }))
      
      // 完成选择
      setStage('uploaded')
      window.dispatchEvent(new CustomEvent('disable-block-selection'))
    }
  }, [stage, selectedAudio, playAudioPrompt, selectedRange])

  // 监听语境块选择事件
  useEffect(() => {
    const handleBlockSelect = (event: CustomEvent) => {
      const { blockId, blockContent } = event.detail
      handleBlockSelection(blockId, blockContent)
    }

    window.addEventListener('context-block-selected', handleBlockSelect as EventListener)
    return () => {
      window.removeEventListener('context-block-selected', handleBlockSelect as EventListener)
    }
  }, [handleBlockSelection])

  // 清理文本，移除多余标点符号，只保留纯净的英文文本
  const cleanTextForRevAI = (rawText: string): string => {
    let cleanedText = rawText
    
    console.log('🔤 原始文本长度:', rawText.length)
    console.log('🔤 原始文本前200字符:', rawText.substring(0, 200))
    
    // 1. 移除HTML标签
    cleanedText = cleanedText.replace(/<[^>]*>/g, '')
    
    // 2. 移除Markdown格式
    cleanedText = cleanedText.replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 图片链接
    cleanedText = cleanedText.replace(/\[[^\]]*\]\([^)]*\)/g, '') // 普通链接
    cleanedText = cleanedText.replace(/\*\*([^*]+)\*\*/g, '$1') // 粗体
    cleanedText = cleanedText.replace(/\*([^*]+)\*/g, '$1') // 斜体
    cleanedText = cleanedText.replace(/`([^`]+)`/g, '$1') // 代码
    
    console.log('🔤 移除Markdown后长度:', cleanedText.length)
    
    // 3. 为了避免Rev AI返回过多punct元素，更激进地清理标点符号
    // 先保存句子边界，然后移除所有标点
    
    // 将句子结束符（包括省略号）替换为特殊标记
    cleanedText = cleanedText.replace(/\.{3,}/g, ' SENTENCE_END ') // 省略号 (3个或更多点)
    cleanedText = cleanedText.replace(/[.!?]+/g, ' SENTENCE_END ') // 其他句子结束符
    
    // 移除所有其他标点符号，只保留字母、数字、空格和我们的特殊标记
    cleanedText = cleanedText.replace(/[^\w\s]/g, ' ')
    
    // 恢复句子结束符（但用空格代替，因为Rev AI会自动处理句子边界）
    cleanedText = cleanedText.replace(/SENTENCE_END/g, ' ')
    
    console.log('🔤 移除标点符号后长度:', cleanedText.length)
    
    // 4. 清理多余的空白字符
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim()
    
    // 5. 确保文本不为空
    if (!cleanedText || cleanedText.trim().length === 0) {
      console.warn('⚠️ 清理后文本为空，使用原始文本')
      cleanedText = rawText.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
    }
    
    console.log('🔤 最终清理后长度:', cleanedText.length)
    console.log('🔤 最终清理后前200字符:', cleanedText.substring(0, 200))
    
    return cleanedText
  }

  // 开始Rev AI处理
  const startRevAIProcessing = async () => {
    if (!selectedAudio || !selectedRange) return

    // 🔄 性能监控初始化
    const performanceMetrics = {
      totalStartTime: performance.now(),
      stages: {} as Record<string, { start: number; end?: number; duration?: number }>,
      wordCounts: {
        original: 0,
        cleaned: 0,
        processed: 0
      }
    }

    const startStage = (stageName: string) => {
      performanceMetrics.stages[stageName] = { start: performance.now() }
      console.log(`⏱️ 开始阶段: ${stageName}`)
    }

    const endStage = (stageName: string) => {
      const stage = performanceMetrics.stages[stageName]
      if (stage) {
        stage.end = performance.now()
        stage.duration = stage.end - stage.start
        console.log(`✅ 完成阶段: ${stageName} - 耗时: ${stage.duration.toFixed(2)}ms`)
      }
    }

    const logStageWordMetrics = (stageName: string, wordCount: number) => {
      const stage = performanceMetrics.stages[stageName]
      if (stage && stage.duration && wordCount > 0) {
        const timePerWord = stage.duration / wordCount
        console.log(`📊 ${stageName} 单词性能: ${timePerWord.toFixed(2)}ms/单词 (${wordCount}个单词)`)
      }
    }

    // 进度条动画函数 - 支持提前完成检测
    const animateProgress = (fromPercent: number, toPercent: number, durationMs: number, completionSignal?: { completed: boolean }) => {
      return new Promise<void>((resolve) => {
        const startTime = performance.now()
        const startProgress = fromPercent
        const progressRange = toPercent - fromPercent
        let lastProgress = startProgress
        const minDisplayTime = Math.min(1000, durationMs * 0.3) // 最小显示时间：不超过预估时间的30%，最多1秒
        
        const updateProgress = () => {
          const now = performance.now()
          const elapsed = now - startTime
          
          // 检查是否提前完成，但要保证最小显示时间
          if (completionSignal?.completed && elapsed >= minDisplayTime) {
            console.log(`🎯 操作提前完成，立即跳转到目标进度: ${toPercent}% (显示时间: ${elapsed.toFixed(0)}ms)`)
            setProgress(toPercent)
            resolve()
            return
          }
          
          const progress = Math.min(elapsed / durationMs, 1)
          
          // 如果操作已完成但还没到最小显示时间，加速动画
          let effectiveProgress = progress
          if (completionSignal?.completed && elapsed < minDisplayTime) {
            // 加速到90%，为最后跳转留出空间
            effectiveProgress = Math.min(0.9, elapsed / minDisplayTime * 0.9)
            console.log(`⚡ 操作已完成，加速动画中: ${(effectiveProgress * 100).toFixed(0)}%`)
          }
          
          // 使用easeOut缓动函数，让进度条开始快速，后来逐渐减慢
          const easeOut = 1 - Math.pow(1 - effectiveProgress, 2)
          const currentPercent = startProgress + (progressRange * easeOut)
          
          // 确保进度值为整数，避免小数显示
          const roundedPercent = Math.round(Math.min(currentPercent, toPercent))
          
          // 只有当进度值真正改变时才更新状态，避免无意义的重渲染
          if (roundedPercent !== lastProgress || progress >= 1) {
            setProgress(roundedPercent)
            lastProgress = roundedPercent
          }
          
          if (progress < 1 && !(completionSignal?.completed && elapsed >= minDisplayTime)) {
            requestAnimationFrame(updateProgress)
          } else {
            setProgress(toPercent)
            resolve()
          }
        }
        
        requestAnimationFrame(updateProgress)
      })
    }

    setStage('processing')
    setProgress(0)
    setError('')

    startStage('初始化和状态更新')

    // 更新speech_results表的状态为processing
    try {
      const { error: updateError } = await supabase
        .from('speech_results')
        .update({ 
          status: 'processing',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAudio.id)

      if (updateError) {
        console.warn('更新音频处理状态失败:', updateError)
      } else {
        console.log('✅ 音频状态已更新为processing')
        // 重新加载音频列表以反映最新状态
        loadAudioRecords()
      }
    } catch (error) {
      console.warn('更新音频处理状态异常:', error)
    }

    endStage('初始化和状态更新')
    startStage('语境块处理')

    // 获取选中范围内的所有语境块ID
    const startIndex = contextBlocks.findIndex(block => block.id === selectedRange.startBlockId)
    const endIndex = contextBlocks.findIndex(block => block.id === selectedRange.endBlockId)
    
    if (startIndex === -1 || endIndex === -1) {
      setError('无法找到选中的语境块')
      setStage('error')
      return
    }

    // 提取范围内的所有语境块ID
    const rangeBlocks = contextBlocks.slice(startIndex, endIndex + 1)
    const selectedBlockIds = rangeBlocks.map(block => block.id)
    
    // 发送处理开始事件 - 传递精确的范围信息
    window.dispatchEvent(new CustomEvent('alignment-processing-start', {
      detail: { 
        selectedBlockIds,
        startBlockId: selectedRange.startBlockId,
        endBlockId: selectedRange.endBlockId,
        rangeBlocks: rangeBlocks
      }
    }))

    try {
      // 过滤掉图片块
      const selectedBlocks = rangeBlocks.filter(block => block.block_type !== 'image')
      
      console.log('📋 语境块过滤结果:')
      console.log('  原始块数量:', rangeBlocks.length)
      console.log('  过滤后块数量:', selectedBlocks.length)
      console.log('  选择范围内的块ID:', selectedBlockIds)
      console.log('  过滤掉的图片块:', rangeBlocks.filter(block => block.block_type === 'image').length)
      
      if (selectedBlocks.length === 0) {
        throw new Error('选中范围内没有有效的文本语境块，请重新选择包含文本内容的语境块')
      }

      endStage('语境块处理')
      startStage('文本清理和预处理')

      // 合并有效语境块的文本并清理
      const rawText = selectedBlocks.map(block => block.content).join(' ')
      const cleanedText = cleanTextForRevAI(rawText)

      // 📊 计算单词数量
      performanceMetrics.wordCounts.original = rawText.split(/\s+/).filter(w => w.length > 0).length
      performanceMetrics.wordCounts.cleaned = cleanedText.split(/\s+/).filter(w => w.length > 0).length
      
      console.log('🔤 文本处理结果:')
      console.log('  原始文本长度:', rawText.length)
      console.log('  清理后文本长度:', cleanedText.length)
      console.log('  原始单词数:', performanceMetrics.wordCounts.original)
      console.log('  清理后单词数:', performanceMetrics.wordCounts.cleaned)
      console.log('  清理后文本预览:', cleanedText.substring(0, 200) + '...')
      
      // 详细的语境块信息
      console.log('📋 详细的语境块信息:')
      selectedBlocks.forEach((block, index) => {
        console.log(`  块 ${index + 1} (ID: ${block.id}):`)
        console.log(`    类型: ${block.block_type}`)
        console.log(`    内容长度: ${block.content.length}`)
        console.log(`    内容预览: ${block.content.substring(0, 100)}...`)
      })
      
      // 在测试模式下，将完整文本保存到全局变量供调试
      if (DEBUG_MODE) {
        (window as any).debugTextData = {
          originalText: rawText,
          cleanedText: cleanedText,
          selectedBlocks: selectedBlocks.map(block => ({
            id: block.id,
            type: block.block_type,
            content: block.content
          }))
        }
        console.log('🧪 完整调试数据已保存到 window.debugTextData')
      }
      
      // 验证清理后的文本是否有效
      if (!cleanedText || cleanedText.trim().length < 10) {
        throw new Error('清理后的文本太短或为空，请检查选中的语境块是否包含有效的英文文本')
      }

      endStage('文本清理和预处理')
      logStageWordMetrics('文本清理和预处理', performanceMetrics.wordCounts.cleaned)

      // 🎯 前三个阶段完成，进度设为1%
      setProgress(1)
      
      // 🎯 开始Rev AI强制对齐阶段 (1% -> 80%)
      // 基于性能分析：大约50ms/单词的处理时间
      const revAIEstimatedDuration = performanceMetrics.wordCounts.cleaned * 50 // 50ms per word
      console.log(`🚀 开始Rev AI强制对齐动画 - 预计耗时: ${revAIEstimatedDuration}ms (${performanceMetrics.wordCounts.cleaned}单词 × 50ms/单词)`)
      
      // 创建Rev AI完成信号
      const revAICompletionSignal = { completed: false }
      
      // 启动Rev AI进度条动画 (1% -> 79%)
      const revAIProgressPromise = animateProgress(1, 79, revAIEstimatedDuration, revAICompletionSignal)
      
      startStage('Rev AI 强制对齐')

      // 调用Rev AI强制对齐 - 使用清理后的文本
      const alignmentRes = await fetch('/api/rev-ai-alignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: selectedAudio.audio_url,
          transcript: cleanedText, // 使用清理后的文本
          speechId: selectedAudio.id
        })
      })

      if (!alignmentRes.ok) {
        const errorData = await alignmentRes.json()
        throw new Error(errorData.error || '强制对齐失败')
      }

      const alignmentData = await alignmentRes.json()
      
      // Rev AI操作完成，触发提前完成信号
      revAICompletionSignal.completed = true
      console.log('🎯 Rev AI强制对齐API调用完成，触发进度条提前完成')
      
      endStage('Rev AI 强制对齐')
      logStageWordMetrics('Rev AI 强制对齐', performanceMetrics.wordCounts.cleaned)

      // 等待Rev AI进度条动画完成，然后设置为80%
      await revAIProgressPromise
      setProgress(80)
      console.log('✅ Rev AI强制对齐完成，进度条已到达80%')

      // 🎯 开始数据处理和保存阶段 (80% -> 100%)
      // 基于性能分析：大约8ms/单词的处理时间 (大幅优化后)
      const dbEstimatedDuration = performanceMetrics.wordCounts.cleaned * 8 // 8ms per word
      console.log(`🗄️ 开始数据库处理动画 - 预计耗时: ${dbEstimatedDuration}ms (${performanceMetrics.wordCounts.cleaned}单词 × 8ms/单词)`)
      
      // 创建数据库完成信号
      const dbCompletionSignal = { completed: false }
      
      // 启动数据库进度条动画 (80% -> 99%)
      const dbProgressPromise = animateProgress(80, 99, dbEstimatedDuration, dbCompletionSignal)
      
      startStage('数据处理和保存')

      // 并行处理：句子切割和数据写入 - 传递过滤后的有效块和清理后的文本
      const [_, alignmentDebugData] = await Promise.all([
        processSentenceSegmentation(alignmentData, cleanedText),
        writeAlignmentData(alignmentData, selectedBlocks, cleanedText)
      ])

      // 数据库操作完成，触发提前完成信号
      dbCompletionSignal.completed = true
      console.log('🎯 数据库操作完成，触发进度条提前完成')

      endStage('数据处理和保存')
      logStageWordMetrics('数据处理和保存', performanceMetrics.wordCounts.cleaned)

      // 等待数据库进度条动画完成，然后设置为100%
      await dbProgressPromise
      setProgress(100)
      console.log('✅ 数据处理和保存完成，进度条已到达100%')
      
      setStage('completed')

      // 📊 最终性能报告
      const totalDuration = performance.now() - performanceMetrics.totalStartTime
      console.log('\n🏁 === 性能分析报告 ===')
      console.log(`总处理时长: ${totalDuration.toFixed(2)}ms (${(totalDuration / 1000).toFixed(2)}秒)`)
      console.log(`处理单词数: ${performanceMetrics.wordCounts.cleaned}个`)
      console.log(`平均处理速度: ${(totalDuration / performanceMetrics.wordCounts.cleaned).toFixed(2)}ms/单词`)
      console.log(`处理速度: ${(performanceMetrics.wordCounts.cleaned / (totalDuration / 1000)).toFixed(2)} 单词/秒`)
      
      console.log('\n📊 各阶段详细分析:')
      Object.entries(performanceMetrics.stages).forEach(([stageName, stage]) => {
        if (stage.duration) {
          const percentage = (stage.duration / totalDuration * 100).toFixed(1)
          console.log(`  ${stageName}: ${stage.duration.toFixed(2)}ms (${percentage}%)`)
        }
      })
      
      // 更新speech_results表的状态为completed
      try {
        // 构建对齐信息
        const alignedBlockIds = rangeBlocks.map(block => block.id);
        
        // 获取对齐语境块的章节信息
        let chapterTitle = '';
        let alignedChapterId = null;
        
        // 通过parent_id查找章节信息
        if (rangeBlocks.length > 0) {
          const { data: chapterData, error: chapterError } = await supabase
            .from('chapters')
            .select('id, title')
            .eq('parent_id', rangeBlocks[0].parent_id)
            .single();
            
          if (chapterError) {
            console.warn('获取章节信息失败:', chapterError);
          } else if (chapterData) {
            chapterTitle = chapterData.title;
            alignedChapterId = chapterData.id;
          }
        }
        
        // 根据章节标题生成音频名称
        const audioName = chapterTitle ? `${chapterTitle} 音频` : selectedAudio.name || '未命名音频';
        
        // 构建对齐元数据
        const alignmentMetadata = {
          confidence_score: 0.95, // 可以从Rev AI结果中获取实际置信度
          alignment_method: 'rev-ai',
          start_time: 0,
          end_time: selectedAudio.duration || 0,
          word_count: cleanedText.split(/\s+/).length,
          sentence_count: selectedBlocks.reduce((total, block) => total + splitTextIntoSentences(block.content).length, 0), // 计算总句子数
          aligned_at: new Date().toISOString(),
          selected_blocks_count: rangeBlocks.length
        };
        
        const { error: updateError } = await supabase
          .from('speech_results')
          .update({ 
            status: 'completed',
            name: audioName, // 根据章节命名
            aligned_chapter_id: alignedChapterId, // 对齐的章节ID
            aligned_block_ids: alignedBlockIds, // 对齐的语境块ID数组
            alignment_metadata: alignmentMetadata, // 对齐元数据
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedAudio.id)

        if (updateError) {
          console.warn('更新音频状态失败:', updateError)
        } else {
          console.log('✅ 音频状态已更新为completed，音频名称:', audioName)
          // 重新加载音频列表以反映最新状态
          await loadAudioRecords()
        }
      } catch (error) {
        console.warn('更新音频状态异常:', error)
      }
      
      toast.success('音频处理完成！')
      
      // 发送处理完成事件
      window.dispatchEvent(new CustomEvent('alignment-processing-complete'))
      
      // 测试模式：打开rev-ai-test页面展示对齐结果
      if (DEBUG_MODE && alignmentDebugData) {
        console.log('🧪 测试模式：准备打开测试页面展示对齐结果')
        
        // 将调试数据存储到localStorage（更可靠）
        const debugDataKey = `alignment-debug-${Date.now()}`
        localStorage.setItem(debugDataKey, JSON.stringify(alignmentDebugData))
        
        // 延迟打开测试页面，让用户看到完成状态
        setTimeout(() => {
          const testUrl = `${window.location.origin}/rev-ai-test?debug=true&dataKey=${debugDataKey}`
          console.log('🧪 正在打开测试页面:', testUrl)
          
          // 尝试打开新窗口
          const newWindow = window.open(testUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')
          
          if (newWindow) {
            console.log('🧪 测试页面已打开')
            toast.success('已打开测试页面展示对齐结果', {
              duration: 3000,
              position: 'top-center'
            })
          } else {
            console.warn('🧪 无法打开新窗口，可能被浏览器阻止')
            toast.warning('无法打开新窗口，请检查浏览器弹窗设置', {
              duration: 5000,
              position: 'top-center'
            })
            
            // 备用方案：在当前窗口打开
            window.location.href = testUrl
          }
        }, 1000)
      }
      
      // 通知父组件处理完成
      setTimeout(() => {
        onProcessingComplete()
      }, 2000)
      
    } catch (error: any) {
      // 📊 错误时也记录性能数据
      const totalDuration = performance.now() - performanceMetrics.totalStartTime
      console.error('❌ 处理失败:', error)
      console.log(`\n⚠️ === 失败前性能分析 ===`)
      console.log(`失败前处理时长: ${totalDuration.toFixed(2)}ms (${(totalDuration / 1000).toFixed(2)}秒)`)
      if (performanceMetrics.wordCounts.cleaned > 0) {
        console.log(`处理单词数: ${performanceMetrics.wordCounts.cleaned}个`)
        console.log(`失败前平均速度: ${(totalDuration / performanceMetrics.wordCounts.cleaned).toFixed(2)}ms/单词`)
      }
      
      console.log('\n📊 已完成的阶段:')
      Object.entries(performanceMetrics.stages).forEach(([stageName, stage]) => {
        if (stage.duration) {
          const percentage = (stage.duration / totalDuration * 100).toFixed(1)
          console.log(`  ✅ ${stageName}: ${stage.duration.toFixed(2)}ms (${percentage}%)`)
        } else if (stage.start) {
          console.log(`  ⏸️ ${stageName}: 进行中 (已启动)`)
        }
      })
      
      setError(error.message || '处理失败')
      setStage('error')
      
      // 更新speech_results表的状态为error
      try {
        const { error: updateError } = await supabase
          .from('speech_results')
          .update({ 
            status: 'error',
            error_message: error.message || '处理失败',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedAudio.id)

        if (updateError) {
          console.warn('更新音频错误状态失败:', updateError)
        } else {
          console.log('✅ 音频状态已更新为error')
          // 重新加载音频列表以反映最新状态
          await loadAudioRecords()
        }
      } catch (updateError) {
        console.warn('更新音频错误状态异常:', updateError)
      }
      
      // 发送处理完成事件（即使失败也要清除动画）
      window.dispatchEvent(new CustomEvent('alignment-processing-complete'))
    }
  }

  // 处理句子切割
  const processSentenceSegmentation = async (alignmentData: any, cleanedText: string) => {
    // 根据标点符号切割英文句子
    const sentences = cleanedText.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    // 将Rev AI的单词时间戳映射到句子
    const sentenceTimestamps = mapWordsToSentences(alignmentData.result.monologues[0].elements, sentences)
    
    return sentenceTimestamps
  }

  // 将单词时间戳映射到句子
  const mapWordsToSentences = (elements: any[], sentences: string[]) => {
    const sentenceTimestamps = []
    let currentSentenceIndex = 0
    let currentSentenceWords = []
    let currentSentenceText = ''

    for (const element of elements) {
      if (element.type === 'text') {
        currentSentenceWords.push(element)
        currentSentenceText += element.value
        
        // 检查是否到达句子结尾
        if (currentSentenceText.includes('.') || currentSentenceText.includes('!') || currentSentenceText.includes('?')) {
          if (currentSentenceWords.length > 0) {
            sentenceTimestamps.push({
              sentence: sentences[currentSentenceIndex],
              startTime: currentSentenceWords[0].ts,
              endTime: currentSentenceWords[currentSentenceWords.length - 1].end_ts,
              words: currentSentenceWords.map(word => ({
                word: word.value,
                startTime: word.ts,
                endTime: word.end_ts,
                confidence: word.confidence
              }))
            })
          }
          
          currentSentenceIndex++
          currentSentenceWords = []
          currentSentenceText = ''
        }
      }
    }

    return sentenceTimestamps
  }

  // 写入对齐数据到数据库
  const writeAlignmentData = async (alignmentData: any, selectedBlocks: any[], cleanedText: string) => {
    // 📊 数据库写入性能监控
    const dbPerformance = {
      startTime: performance.now(),
      stages: {} as Record<string, { start: number; end?: number; duration?: number; wordCount?: number }>
    }

    const startDbStage = (stageName: string, wordCount?: number) => {
      dbPerformance.stages[stageName] = { start: performance.now(), wordCount }
      console.log(`🗄️ 开始数据库操作: ${stageName}`)
    }

    const endDbStage = (stageName: string) => {
      const stage = dbPerformance.stages[stageName]
      if (stage) {
        stage.end = performance.now()
        stage.duration = stage.end - stage.start
        console.log(`✅ 完成数据库操作: ${stageName} - 耗时: ${stage.duration.toFixed(2)}ms`)
        if (stage.wordCount && stage.wordCount > 0) {
          const timePerWord = stage.duration / stage.wordCount
          console.log(`📊 ${stageName} 数据库性能: ${timePerWord.toFixed(2)}ms/单词`)
        }
      }
    }

    startDbStage('数据预处理和结构化')
    
    // 检查Rev AI返回的数据结构
    if (!alignmentData.result || !alignmentData.result.monologues || alignmentData.result.monologues.length === 0) {
      throw new Error('Rev AI返回的数据格式不正确')
    }

    console.log('🎤 Rev AI返回的说话人数量:', alignmentData.result.monologues.length)
    
    // 合并所有说话人的文本元素，按时间戳排序
    const allTextElements: any[] = []
    
    for (let speakerIndex = 0; speakerIndex < alignmentData.result.monologues.length; speakerIndex++) {
      const monologue = alignmentData.result.monologues[speakerIndex]
      console.log(`🎤 处理说话人 ${speakerIndex} (speaker ${monologue.speaker}), 元素数量: ${monologue.elements.length}`)
      
      if (monologue.elements) {
        const speakerTextElements = monologue.elements.filter((element: any) => element.type === 'text')
        console.log(`🎤 说话人 ${speakerIndex} 的文本元素数量: ${speakerTextElements.length}`)
        
        speakerTextElements.forEach((element: any) => {
          allTextElements.push({
            ...element,
            speaker: monologue.speaker
          })
        })
      }
    }
    
    allTextElements.sort((a, b) => a.ts - b.ts)
    const totalWords = allTextElements.length
    console.log('🎤 合并后的总文本元素数量:', totalWords)

    // 1. 按语境块顺序划分句子，构建完整的数据结构
    console.log('📋 开始构建完整的数据结构...')
    
    const alignmentStructure = {
      speechId: selectedAudio!.id,
      blocks: [] as any[],
      totalSentences: 0,
      totalWords: 0
    }
    
    let globalSentenceOrder = 1
    let wordIndex = 0
    
    for (let blockIndex = 0; blockIndex < selectedBlocks.length; blockIndex++) {
      const block = selectedBlocks[blockIndex]
      console.log(`📋 处理语境块 ${blockIndex + 1} (ID: ${block.id})`)
      
      const blockSentenceTexts = splitTextIntoSentences(block.content)
      const blockData = {
        blockId: block.id,
        originalContent: block.content,
        sentences: [] as any[]
      }
      
      for (let sentenceIndex = 0; sentenceIndex < blockSentenceTexts.length; sentenceIndex++) {
        const sentenceText = blockSentenceTexts[sentenceIndex]
        const cleanedSentenceText = cleanTextForRevAI(sentenceText)
        const expectedWords = cleanedSentenceText.split(/\s+/).filter((w: string) => w.length > 0)
      
      // 收集匹配的Rev AI单词
      const matchedWords: any[] = []
      let startTime = null
      let endTime = null
      
      for (let i = 0; i < expectedWords.length && wordIndex < allTextElements.length; i++) {
        const revAIWord = allTextElements[wordIndex]
        matchedWords.push(revAIWord)
        
        if (startTime === null) {
          startTime = revAIWord.ts
        }
        endTime = revAIWord.end_ts
        wordIndex++
      }
      
        const sentenceData = {
          order: globalSentenceOrder,
          textContent: sentenceText,
          beginTime: Math.round((startTime || 0) * 1000),
          endTime: Math.round((endTime || 0) * 1000),
          orderInBlock: sentenceIndex + 1,
          words: matchedWords.map((word: any) => ({
          word: word.value,
            beginTime: Math.round((word.ts || 0) * 1000),
            endTime: Math.round((word.end_ts || 0) * 1000)
          }))
        }
        
        blockData.sentences.push(sentenceData)
        globalSentenceOrder++
      }
      
      alignmentStructure.blocks.push(blockData)
    }
    
    alignmentStructure.totalSentences = globalSentenceOrder - 1
    alignmentStructure.totalWords = totalWords
    
    console.log(`📋 数据结构构建完成: ${alignmentStructure.blocks.length} 个块, ${alignmentStructure.totalSentences} 个句子, ${alignmentStructure.totalWords} 个单词`)
    
    endDbStage('数据预处理和结构化')
    startDbStage('批量数据库操作', totalWords)
    
    // 2. 使用单个API调用进行批量操作
    console.log('🚀 开始执行批量数据库操作...')
    
    try {
      // 获取用户token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('用户未登录或session已过期')
      }

      const response = await fetch('/api/alignment/batch-insert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(alignmentStructure)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '批量插入失败')
      }
      
      const result = await response.json()
      console.log('✅ 批量数据库操作完成:', result)
      
      endDbStage('批量数据库操作')
      
      // 3. 处理测试模式调试数据
    let debugData = null
    if (DEBUG_MODE) {
        console.log('🧪 构建测试模式调试数据...')
        
      debugData = {
        originalText: selectedBlocks.map(block => block.content).join(' '),
        cleanedText: cleanedText,
          sentences: alignmentStructure.blocks.flatMap(block => 
            block.sentences.map((s: any) => s.textContent)
          ),
        revAIElements: allTextElements,
        fullRevAIResponse: alignmentData,
          alignmentResult: alignmentStructure.blocks.flatMap((block, blockIdx) => 
            block.sentences.map((sentence: any, sentenceIdx: number) => ({
              id: sentence.order,
              text: sentence.textContent,
              startTime: sentence.beginTime / 1000,
              endTime: sentence.endTime / 1000,
              words: sentence.words.map((word: any) => ({
                text: word.word,
                startTime: word.beginTime / 1000,
                endTime: word.endTime / 1000,
                confidence: 0.9, // 默认置信度
                speaker: 0
              }))
            }))
          ),
        audioUrl: selectedAudio?.audio_url || '',
        processedAt: new Date().toISOString(),
        rawOriginalText: selectedBlocks.map(block => block.content).join(' '),
        selectedBlocksInfo: selectedBlocks.map(block => ({
          id: block.id,
          type: block.block_type,
          content: block.content,
          contentLength: block.content.length
        })),
        speakerStats: alignmentData.result.monologues.map((mono: any, index: number) => ({
          speakerId: mono.speaker,
          monologueIndex: index,
          totalElements: mono.elements.length,
          textElements: mono.elements.filter((el: any) => el.type === 'text').length,
          punctElements: mono.elements.filter((el: any) => el.type === 'punct').length
        })),
          databaseResults: alignmentStructure.blocks.map((block: any, blockIndex: number) => ({
            blockId: block.blockId,
            blockType: 'text',
            blockIndex: blockIndex + 1,
            originalContent: block.originalContent.substring(0, 100) + (block.originalContent.length > 100 ? '...' : ''),
            cleanedContent: cleanTextForRevAI(block.originalContent).substring(0, 100) + '...',
            sentenceCount: block.sentences.length,
            totalWords: block.sentences.reduce((sum: number, s: any) => sum + s.words.length, 0),
            sentences: block.sentences.map((sentence: any) => ({
              sentenceId: `temp-${sentence.order}`, // 临时ID，实际会在API中生成
              sentenceText: sentence.textContent,
              sentenceOrder: sentence.order,
              beginTime: sentence.beginTime,
              endTime: sentence.endTime,
              words: sentence.words,
              wordCount: sentence.words.length
            })),
            blockBeginTime: block.sentences.length > 0 ? 
              Math.min(...block.sentences.map((s: any) => s.beginTime)) : 0,
            blockEndTime: block.sentences.length > 0 ? 
              Math.max(...block.sentences.map((s: any) => s.endTime)) : 0
          }))
        }
        console.log('🧪 测试模式数据收集完成')
      }

      // 📊 数据库性能总结报告
      const totalDbDuration = performance.now() - dbPerformance.startTime
      console.log('\n🗄️ === 优化后数据库操作性能报告 ===')
      console.log(`数据库总耗时: ${totalDbDuration.toFixed(2)}ms (${(totalDbDuration / 1000).toFixed(2)}秒)`)
      console.log(`处理单词数: ${totalWords}个`)
      console.log(`平均速度: ${(totalDbDuration / totalWords).toFixed(2)}ms/单词`)
      console.log(`性能提升: 预期比原方案快 5-10 倍`)
      
      console.log('\n📊 优化后各阶段分析:')
      Object.entries(dbPerformance.stages).forEach(([stageName, stage]) => {
        if (stage.duration) {
          const percentage = (stage.duration / totalDbDuration * 100).toFixed(1)
          console.log(`  ${stageName}: ${stage.duration.toFixed(2)}ms (${percentage}%)`)
          if (stage.wordCount && stage.wordCount > 0) {
            const wordsPerMs = stage.wordCount / stage.duration
            console.log(`    处理速度: ${(wordsPerMs * 1000).toFixed(2)} 项/秒`)
          }
        }
      })

    return debugData
      
    } catch (error: any) {
      console.error('❌ 批量数据库操作失败:', error)
      throw new Error(`批量数据库操作失败: ${error.message}`)
    }
  }

  // 计算字符串相似度（简单版本）
  const calculateStringSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = calculateEditDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  // 计算编辑距离
  const calculateEditDistance = (str1: string, str2: string): number => {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  // 计算两个单词数组的匹配数量
  const calculateWordMatch = (words1: string[], words2: string[]): number => {
    let matchCount = 0
    const used = new Set<number>()
    
    for (const word1 of words1) {
      for (let i = 0; i < words2.length; i++) {
        if (!used.has(i) && word1.toLowerCase() === words2[i].toLowerCase()) {
          matchCount++
          used.add(i)
          break
        }
      }
    }
    
    return matchCount
  }

  // 根据标点符号划分文本为句子
  const splitTextIntoSentences = (text: string): string[] => {
    if (!text || !text.trim()) return []
    
    // 更智能的句子分割逻辑，处理英文文本
    const sentences = []
    let currentSentence = ''
    let i = 0
    
    while (i < text.length) {
      const char = text[i]
      currentSentence += char
      
      // 检查是否是句子结束符
      if (/[.!?]/.test(char)) {
        // 特殊处理省略号 (...)
        if (char === '.') {
          // 检查是否是省略号的开始（支持3个或更多点）
          let dotCount = 1
          let nextIndex = i + 1
          
          // 计算连续点的数量
          while (nextIndex < text.length && text[nextIndex] === '.') {
            dotCount++
            nextIndex++
          }
          
          // 如果有3个或更多点，视为省略号
          if (dotCount >= 3) {
            // 添加剩余的点到当前句子
            for (let j = i + 1; j < nextIndex; j++) {
              currentSentence += text[j]
            }
            
            // 处理省略号后的引号和括号
            while (nextIndex < text.length && /["')\]}>]/.test(text[nextIndex])) {
              currentSentence += text[nextIndex]
              nextIndex++
            }
            
            // 省略号标记句子结束，添加句子
            const trimmedSentence = currentSentence.trim()
            if (trimmedSentence.length > 0) {
              sentences.push(trimmedSentence)
            }
            currentSentence = ''
            i = nextIndex - 1 // -1 因为循环末尾会 i++
            i++
            continue
          }
          
          // 检查是否是缩写（如 Mr., Dr., etc.）
          const isAbbreviation = checkIfAbbreviation(text, i)
          
          // 检查是否是小数点
          const isDecimal = /\d/.test(text[i-1]) && /\d/.test(text[i+1])
          
          if (isAbbreviation || isDecimal) {
            i++
            continue
          }
        }
        
        // 对于 ! 和 ? 以及非缩写的 .，检查后面是否有引号或括号需要包含
        let endIndex = i
        // 只包含紧跟在标点符号后面的引号和括号，不包含空格
        while (endIndex + 1 < text.length && /["')\]}>]/.test(text[endIndex + 1])) {
          endIndex++
          currentSentence += text[endIndex]
        }
        
        // 添加句子到结果中
        const trimmedSentence = currentSentence.trim()
        if (trimmedSentence.length > 0) {
          sentences.push(trimmedSentence)
        }
        
        currentSentence = ''
        i = endIndex
      }
      
      i++
    }
    
    // 添加最后一个句子（如果有）
    const finalSentence = currentSentence.trim()
    if (finalSentence.length > 0) {
      sentences.push(finalSentence)
    }
    
    // 后处理：合并可能被错误分离的引号
    const processedSentences: string[] = []
    for (let i = 0; i < sentences.length; i++) {
      const sentence: string = sentences[i]
      
      // 检查是否是单独的引号或很短的内容（可能是被错误分离的）
      if (sentence.length <= 3 && /^["')\]}>]+$/.test(sentence.trim())) {
        // 如果前面有句子，将这个引号合并到前面的句子
        if (processedSentences.length > 0) {
          processedSentences[processedSentences.length - 1] += sentence
        } else {
          // 如果没有前面的句子，检查后面是否有句子可以合并
          if (i + 1 < sentences.length) {
            sentences[i + 1] = sentence + sentences[i + 1]
          } else {
            // 如果都没有，还是保留这个句子
            processedSentences.push(sentence)
          }
        }
      } else {
        processedSentences.push(sentence)
      }
    }
    
    const result = processedSentences.filter(s => s.length > 0)
    
    // 调试日志：显示句子划分结果
    if (DEBUG_MODE) {
      console.log('📝 句子划分结果:')
      console.log(`  原始文本: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`)
      console.log(`  划分出 ${result.length} 个句子:`)
      result.forEach((sentence, index) => {
        console.log(`    ${index + 1}. "${sentence}"`)
      })
    }
    
    return result
  }

  // 检查是否是常见缩写
  const checkIfAbbreviation = (text: string, dotIndex: number): boolean => {
    // 常见英文缩写列表
    const abbreviations = [
      'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr',
      'vs', 'etc', 'Inc', 'Ltd', 'Corp', 'Co',
      'St', 'Ave', 'Rd', 'Blvd', 'Apt', 'Dept',
      'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
      'a.m', 'p.m', 'AM', 'PM', 'U.S', 'U.K', 'U.N'
    ]
    
    // 向前查找单词开始位置
    let wordStart = dotIndex - 1
    while (wordStart >= 0 && /[a-zA-Z]/.test(text[wordStart])) {
      wordStart--
    }
    wordStart++
    
    // 提取可能的缩写
    const possibleAbbr = text.substring(wordStart, dotIndex)
    
    // 检查是否在缩写列表中
    return abbreviations.some(abbr => 
      abbr.toLowerCase() === possibleAbbr.toLowerCase()
    )
  }

  // 重置选择状态
  const resetSelection = () => {
    setSelectedRange(null)
    setStage('uploaded')
    // 发送开始新选择的事件来重置状态，而不是简单的禁用选择
    window.dispatchEvent(new CustomEvent('enable-block-selection', {
      detail: { mode: 'start' }
    }))
    // 立即再次禁用选择，让界面回到初始状态
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('disable-block-selection'))
    }, 10)
  }

  // 添加返回到音频选择的函数
  const backToAudioSelection = () => {
    setStage('idle')
    setSelectedAudio(null)
    setSelectedRange(null)
    
    // 停止音频播放
    if (audioRef.current) {
      audioRef.current.pause()
      setPlayingAudioId(null)
    }
    
    // 禁用选择模式
    window.dispatchEvent(new CustomEvent('disable-block-selection'))
  }

  // 添加返回到起始块选择的函数
  const backToStartSelection = () => {
    setStage('selecting_start')
    // 清除结束块信息，保留起始块信息
    setSelectedRange(prev => prev ? {
      startBlockId: prev.startBlockId,
      startBlockContent: prev.startBlockContent,
      endBlockId: '',
      endBlockContent: ''
    } : null)
    
    // 停止音频播放
    if (audioRef.current) {
      audioRef.current.pause()
      setPlayingAudioId(null)
    }
    
    // 重新启用起始块选择模式
    window.dispatchEvent(new CustomEvent('enable-block-selection', {
      detail: { mode: 'start' }
    }))
    
    // 播放开始段落音频
    playAudioPrompt('START_SELECTION', { start: 0, duration: 10 })
  }

  // 重复播放当前阶段的音频片段
  const repeatCurrentAudio = useCallback(async () => {
    if (!selectedAudio || !audioRef.current) return
    
    let audioSegment: { start: number, duration: number } | null = null
    let promptType: 'START_SELECTION' | 'END_SELECTION' | 'PROCESSING' | null = null
    
    if (stage === 'selecting_start') {
      audioSegment = { start: 0, duration: 10 }
      promptType = 'START_SELECTION'
    } else if (stage === 'selecting_end') {
      // 确保音频元数据已加载
      if (audioRef.current.readyState === 0) {
        audioRef.current.onloadedmetadata = () => {
          const duration = audioRef.current?.duration || 0
          playAudioPrompt('END_SELECTION', { 
            start: Math.max(0, duration - 10), 
            duration: 10 
          })
        }
        return
      } else {
        const duration = audioRef.current.duration || 0
        audioSegment = { start: Math.max(0, duration - 10), duration: 10 }
        promptType = 'END_SELECTION'
      }
    }
    
    if (audioSegment && promptType) {
      await playAudioPrompt(promptType, audioSegment)
    }
  }, [selectedAudio, stage, playAudioPrompt])

  const renderMainContent = () => {
    switch (stage) {
      case 'idle':
        return (
          <div className="space-y-4">
            {/* 状态卡片 */}
            <motion.div 
              className="text-center p-4 rounded-lg border-2 border-dashed border-border bg-muted/30"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {audioRecords.length === 0 ? (
                <>
                  <motion.div 
                    className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-3"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Music className="w-5 h-5 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">暂无音频</h3>
                    <p className="text-xs text-muted-foreground">
                      请先上传音频文件开始处理
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <motion.div 
                    className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center mb-3"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Target className="w-5 h-5 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">选择音频文件</h3>
                    <p className="text-xs text-muted-foreground">
                      从下方音频列表中选择要处理的音频文件
                    </p>
                  </div>
                </>
              )}
            </motion.div>

            {/* 音频列表 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">音频列表</h3>
                <button className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                        onClick={loadAudioRecords}>
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(59,130,246,0.6)_0%,rgba(59,130,246,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  </span>
                  <div className="relative flex space-x-1 items-center z-10 rounded-full bg-zinc-950 py-1 px-2 ring-1 ring-white/10 justify-center">
                    <RefreshCw className="w-3 h-3" />
                    <span>刷新</span>
                  </div>
                  <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-blue-400/0 via-blue-400/90 to-blue-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                </button>
              </div>
              
              {/* 添加固定高度和滚动条 */}
              <div className="max-h-64 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 pr-2">
                  <AnimatePresence>
                    {isLoadingAudios ? (
                      <div className="col-span-2 flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : audioRecords.length === 0 ? (
                      <motion.div 
                        className="col-span-2 text-center py-8 text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Music className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">暂无音频记录</p>
                        <p className="text-xs mt-1">请先上传音频文件</p>
                      </motion.div>
                    ) : (
                      audioRecords.map((audio, index) => (
                        <motion.div
                          key={audio.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                        >
                          <AudioRectangle
                            audio={audio}
                            isSelected={selectedAudio?.id === audio.id}
                            isPlaying={playingAudioId === audio.id}
                            onClick={() => handleAudioSelect(audio)}
                          />
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        )

      case 'uploaded':
        return (
          <div className="space-y-3">
            {selectedAudio && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <motion.div 
                        className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Volume2 className="w-4 h-4 text-primary" />
                      </motion.div>
                      <div>
                        <h4 className="font-semibold text-sm">
                          {selectedAudio.name || '未命名音频'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          状态: {selectedAudio.status === 'completed' ? '已完成' : '处理中'}
                        </p>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {selectedRange && (
                        <motion.div 
                          className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded-lg mb-3"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <h5 className="font-medium mb-1 text-blue-900 dark:text-blue-100 text-xs">已选择语境范围:</h5>
                          <div className="space-y-0.5 text-xs">
                            <div className="text-blue-800 dark:text-blue-200">
                              <span className="font-medium">起始:</span> {selectedRange.startBlockContent.substring(0, 40)}...
                            </div>
                            <div className="text-blue-800 dark:text-blue-200">
                              <span className="font-medium">结束:</span> {selectedRange.endBlockContent.substring(0, 40)}...
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    <div className="flex gap-2">
                      {!selectedRange ? (
                        <button className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block flex-1"
                                onClick={startBlockSelection}>
                          <span className="absolute inset-0 overflow-hidden rounded-full">
                            <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(249,115,22,0.6)_0%,rgba(249,115,22,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                          </span>
                          <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-1.5 px-3 ring-1 ring-white/10 justify-center">
                            <Target className="w-3 h-3" />
                            <span>选择语境范围</span>
                          </div>
                          <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-orange-400/0 via-orange-400/90 to-orange-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                        </button>
                      ) : (
                        <>
                          <button className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block flex-1"
                                  onClick={startRevAIProcessing}>
                            <span className="absolute inset-0 overflow-hidden rounded-full">
                              <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(147,51,234,0.6)_0%,rgba(147,51,234,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                            </span>
                            <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-1.5 px-3 ring-1 ring-white/10 justify-center">
                              <Zap className="w-3 h-3" />
                              <span>开始强制对齐</span>
                            </div>
                            <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-purple-400/0 via-purple-400/90 to-purple-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                          </button>
                          <button className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                                  onClick={resetSelection}>
                            <span className="absolute inset-0 overflow-hidden rounded-full">
                              <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(107,114,128,0.6)_0%,rgba(107,114,128,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                            </span>
                            <div className="relative flex space-x-1 items-center z-10 rounded-full bg-zinc-950 py-1.5 px-3 ring-1 ring-white/10 justify-center">
                              <span>重新选择</span>
                            </div>
                            <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-gray-400/0 via-gray-400/90 to-gray-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                          </button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 音频列表 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">音频列表</h3>
                <button className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                        onClick={loadAudioRecords}>
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(59,130,246,0.6)_0%,rgba(59,130,246,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  </span>
                  <div className="relative flex space-x-1 items-center z-10 rounded-full bg-zinc-950 py-1 px-2 ring-1 ring-white/10 justify-center">
                    <RefreshCw className="w-3 h-3" />
                    <span>刷新</span>
                  </div>
                  <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-blue-400/0 via-blue-400/90 to-blue-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                </button>
              </div>
              
              {/* 添加固定高度和滚动条 */}
              <div className="max-h-80 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 pr-2">
                  <AnimatePresence>
                    {audioRecords.map((audio, index) => (
                      <motion.div
                        key={audio.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <AudioRectangle
                          audio={audio}
                          isSelected={selectedAudio?.id === audio.id}
                          isPlaying={playingAudioId === audio.id}
                          onClick={() => handleAudioSelect(audio)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        )

      case 'selecting_start':
        return (
          <motion.div 
            className="text-center space-y-4 py-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* 创建一个包装器来处理hover状态 */}
            <motion.div
              className="group"
              whileHover="hover"
              initial="initial"
              variants={{
                initial: {},
                hover: {}
              }}
            >
              <motion.div 
                className="w-16 h-16 mx-auto cursor-pointer"
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                variants={{
                  initial: { 
                    scale: 1,
                  },
                  hover: { 
                    scale: 1.15,
                  }
                }}
                whileTap={{ scale: 0.95 }}
                onClick={repeatCurrentAudio}
              >
                <motion.div 
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-yellow-600 flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Target className="w-8 h-8 text-white" />
                </motion.div>
              </motion.div>
              
              <div className="mt-4">
                <div className="relative h-6 mb-2">
                  <motion.h3 
                    className="text-lg font-semibold text-orange-600 absolute inset-x-0"
                    variants={{
                      initial: { opacity: 1, y: 0 },
                      hover: { opacity: 0, y: -10 }
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    选择起始语境块
                  </motion.h3>
                  
                  <motion.h3 
                    className="text-lg font-semibold text-orange-600 absolute inset-x-0"
                    variants={{
                      initial: { opacity: 0, y: 10 },
                      hover: { opacity: 1, y: 0 }
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    🎵 点击重复播放开头
                  </motion.h3>
                </div>
                
                <motion.div
                  variants={{
                    initial: { opacity: 1 },
                    hover: { opacity: 0.8 }
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-muted-foreground mb-1 text-sm">
                    📍 在左侧语境块中找到音频的开始位置
                  </p>
                  <p className="text-xs text-orange-500/70">
                    💡 已为您播放音频开头10秒，点击圆形可重复收听
                  </p>
                </motion.div>
              </div>
            </motion.div>

            {/* 返回按钮 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="pt-4"
            >
              <button 
                className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                onClick={backToAudioSelection}
              >
                <span className="absolute inset-0 overflow-hidden rounded-full">
                  <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(107,114,128,0.6)_0%,rgba(107,114,128,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </span>
                <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-1.5 px-4 ring-1 ring-white/10 justify-center">
                  <ChevronLeft className="w-3 h-3" />
                  <span>返回音频选择</span>
                </div>
                <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-gray-400/0 via-gray-400/90 to-gray-400/0 transition-opacity duration-500 group-hover:opacity-40" />
              </button>
            </motion.div>
          </motion.div>
        )

      case 'selecting_end':
        return (
          <motion.div 
            className="text-center space-y-4 py-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* 创建一个包装器来处理hover状态 */}
            <motion.div
              className="group"
              whileHover="hover"
              initial="initial"
              variants={{
                initial: {},
                hover: {}
              }}
            >
              <motion.div 
                className="w-16 h-16 mx-auto cursor-pointer"
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, -5, 5, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                variants={{
                  initial: { 
                    scale: 1,
                  },
                  hover: { 
                    scale: 1.15,
                  }
                }}
                whileTap={{ scale: 0.95 }}
                onClick={repeatCurrentAudio}
              >
                <motion.div 
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Check className="w-8 h-8 text-white" />
                </motion.div>
              </motion.div>
              
              <div className="mt-4">
                <div className="relative h-6 mb-2">
                  <motion.h3 
                    className="text-lg font-semibold text-green-600 absolute inset-x-0"
                    variants={{
                      initial: { opacity: 1, y: 0 },
                      hover: { opacity: 0, y: -10 }
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    选择结束语境块
                  </motion.h3>
                  
                  <motion.h3 
                    className="text-lg font-semibold text-green-600 absolute inset-x-0"
                    variants={{
                      initial: { opacity: 0, y: 10 },
                      hover: { opacity: 1, y: 0 }
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    🎵 点击重复播放结尾
                  </motion.h3>
                </div>
                
                <motion.div
                  variants={{
                    initial: { opacity: 1 },
                    hover: { opacity: 0.8 }
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-muted-foreground mb-1 text-sm">
                    🎯 在左侧语境块中标记音频的结束位置
                  </p>
                  <p className="text-xs text-green-500/70">
                    🔚 已为您播放音频结尾10秒，确认这是您想要的结束点
                  </p>
                </motion.div>
              </div>
            </motion.div>

            {/* 返回按钮 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="pt-4"
            >
              <button 
                className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                onClick={backToStartSelection}
              >
                <span className="absolute inset-0 overflow-hidden rounded-full">
                  <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(107,114,128,0.6)_0%,rgba(107,114,128,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </span>
                <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-1.5 px-4 ring-1 ring-white/10 justify-center">
                  <ChevronLeft className="w-3 h-3" />
                  <span>返回起始选择</span>
                </div>
                <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-gray-400/0 via-gray-400/90 to-gray-400/0 transition-opacity duration-500 group-hover:opacity-40" />
              </button>
            </motion.div>
          </motion.div>
        )

      case 'processing':
        return (
          <motion.div 
            className="text-center space-y-8 py-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* 球体容器 */}
            <div className="flex justify-center relative">
              <AudioProcessingOrb 
                size={240} 
                hue={270}
                hoverIntensity={0.3}
                rotateOnHover={true}
              />
              {/* 球体中心文字 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center translate-y-2">
                  <motion.div 
                    className="relative"
                    animate={{
                      scale: [1, 1.02, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    {/* 主文字 */}
                    <div className="relative z-10">
                      <motion.span 
                        className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 font-bold text-lg tracking-[0.3em] uppercase"
                        animate={{
                          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                        style={{
                          backgroundSize: "200% 100%",
                          filter: "drop-shadow(0 0 8px rgba(147, 51, 234, 0.3))",
                        }}
                      >
                        强制对齐中
                      </motion.span>
                    </div>
                    
                    {/* 光晕效果 */}
                    <motion.div 
                      className="absolute inset-0 -z-10"
                      animate={{
                        opacity: [0.3, 0.6, 0.3],
                        scale: [0.95, 1.05, 0.95],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <span className="text-purple-400/40 font-bold text-lg tracking-[0.3em] uppercase blur-sm">
                        强制对齐中
                      </span>
                    </motion.div>
                    
                    {/* 底部进度点 */}
                    <div className="flex justify-center mt-4 space-x-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1 h-1 bg-purple-400/60 rounded-full"
                          animate={{
                            opacity: [0.3, 1, 0.3],
                            scale: [0.8, 1.2, 0.8],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.2,
                            ease: "easeInOut"
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
            
            {/* 现代化进度条 */}
            <div className="max-w-md mx-auto space-y-4">
              {/* 进度条容器 */}
              <div className="relative">
                <div className="w-full h-1 bg-gray-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-gray-700/30">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full relative"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ 
                      duration: 0, 
                      ease: "linear"
                    }}
                  >
                    {/* 进度条光效 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                  </motion.div>
                </div>
                
                {/* 进度百分比 */}
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm font-medium text-gray-300 tracking-wide">
                    {progress}%
                  </span>
                  <span className="text-sm font-medium text-gray-400 tracking-wide">
                    完成
                  </span>
              </div>
              </div>
              
              {/* 状态描述 */}
              <motion.div 
                className="text-center"
                key={progress < 1 ? 'init' : progress < 80 ? 'revai' : progress < 100 ? 'save' : 'complete'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-gray-300 text-sm font-medium tracking-wide">
                  {progress < 1 && "正在初始化和预处理文本"}
                  {progress >= 1 && progress < 80 && "Rev AI正在进行音频转录和强制对齐"}
                  {progress >= 80 && progress < 100 && "正在处理对齐结果并保存到数据库"}
                  {progress >= 100 && "处理完成，准备跳转"}
                </p>
                
                {/* 技术细节 */}
                <p className="text-gray-500 text-xs mt-2 tracking-wider">
                  {progress < 1 && "INITIALIZING • TEXT PROCESSING"}
                  {progress >= 1 && progress < 80 && "PROCESSING • FORCED ALIGNMENT"}
                  {progress >= 80 && progress < 100 && "SAVING • DATABASE SYNC"}
                  {progress >= 100 && "COMPLETE • READY"}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )

      case 'completed':
        return (
          <div className="space-y-4">
            <Confetti active={true} />
            <motion.div 
              className="text-center space-y-4 py-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div 
                className="w-16 h-16 mx-auto relative z-10"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, delay: 0.2, type: "spring", bounce: 0.4 }}
              >
                <motion.div
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Check className="w-8 h-8 text-white" />
                </motion.div>
              </motion.div>
              <div>
                <motion.h3 
                  className="text-lg font-semibold mb-2"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  🎉 处理完成！
                </motion.h3>
                <motion.p 
                  className="text-muted-foreground mb-3 text-sm"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                >
                  音频已成功对齐到语境块，现在可以进行逐句点读了
                </motion.p>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                >
                  <button className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                          onClick={() => setStage('uploaded')}>
                    <span className="absolute inset-0 overflow-hidden rounded-full">
                      <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(34,197,94,0.6)_0%,rgba(34,197,94,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    </span>
                    <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-1.5 px-4 ring-1 ring-white/10 justify-center">
                      <Target className="w-3 h-3" />
                      <span>处理其他音频</span>
                    </div>
                    <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-green-400/0 via-green-400/90 to-green-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                  </button>
                </motion.div>
              </div>
            </motion.div>

            {/* 音频列表 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">音频列表</h3>
                <button className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
                        onClick={loadAudioRecords}>
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(59,130,246,0.6)_0%,rgba(59,130,246,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  </span>
                  <div className="relative flex space-x-1 items-center z-10 rounded-full bg-zinc-950 py-1 px-2 ring-1 ring-white/10 justify-center">
                    <RefreshCw className="w-3 h-3" />
                    <span>刷新</span>
                  </div>
                  <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-blue-400/0 via-blue-400/90 to-blue-400/0 transition-opacity duration-500 group-hover:opacity-40" />
                </button>
              </div>
              
              {/* 添加固定高度和滚动条 */}
              <div className="max-h-64 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 pr-2">
                  <AnimatePresence>
                    {isLoadingAudios ? (
                      <div className="col-span-2 flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : audioRecords.length === 0 ? (
                      <motion.div 
                        className="col-span-2 text-center py-8 text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Music className="w-8 h-8 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">暂无音频记录</p>
                        <p className="text-xs mt-1">请先上传音频文件</p>
                      </motion.div>
                    ) : (
                      audioRecords.map((audio, index) => (
                        <motion.div
                          key={audio.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                        >
                          <AudioRectangle
                            audio={audio}
                            isSelected={selectedAudio?.id === audio.id}
                            isPlaying={playingAudioId === audio.id}
                            onClick={() => handleAudioSelect(audio)}
                          />
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        )

      case 'error':
        return (
          <motion.div 
            className="text-center space-y-4 py-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div 
              className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center"
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <X className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h3 className="text-lg font-semibold mb-2">处理失败</h3>
              <Alert className="max-w-md mx-auto">
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
              <button className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block mt-4"
                      onClick={() => setStage('uploaded')}>
                <span className="absolute inset-0 overflow-hidden rounded-full">
                  <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(239,68,68,0.6)_0%,rgba(239,68,68,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </span>
                <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-1.5 px-4 ring-1 ring-white/10 justify-center">
                  <span>重试</span>
                </div>
                <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-red-400/0 via-red-400/90 to-red-400/0 transition-opacity duration-500 group-hover:opacity-40" />
              </button>
            </div>
          </motion.div>
        )

      default:
        return null
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <audio
        ref={audioRef}
        src={selectedAudio?.audio_url}
        preload="metadata"
      />
      
      <div className="p-4">
        {renderMainContent()}
      </div>
    </div>
  )
} 
 