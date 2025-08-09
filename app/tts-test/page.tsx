'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Play, Download, Volume2, Mic, Sparkles, Headphones, Settings, FileAudio, Palette, PlayCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useSession } from '@/hooks/use-session'
import { getVoicesByCategory, getVoiceCategories, getVoiceInfo, loadVoicesFromCSV } from '@/types/tts'
import { useEffect } from 'react'

// 获取音频 MIME 类型
const getMimeType = (encoding: string): string => {
  switch (encoding) {
    case 'mp3': return 'audio/mpeg'
    case 'wav': return 'audio/wav'
    case 'pcm': return 'audio/pcm'
    case 'ogg_opus': return 'audio/ogg'
    default: return 'audio/mpeg'
  }
}

export default function TTSTestPage() {
  const { session } = useSession()
  const [text, setText] = useState('')
  
  // 加载音色数据
  useEffect(() => {
    const loadVoices = async () => {
      setIsLoadingVoices(true)
      try {
        await loadVoicesFromCSV()
        // 加载完成后，选择默认分类的第一个音色
        const categories = getVoiceCategories()
        if (categories.length > 0) {
          const defaultCategory = categories[0]
          setSelectedCategory(defaultCategory)
          const voices = getVoicesByCategory(defaultCategory)
          if (voices.length > 0) {
            setVoiceType(voices[0].id)
          }
        }
      } catch (error) {
        console.error('加载音色失败:', error)
      } finally {
        setIsLoadingVoices(false)
      }
    }
    loadVoices()
  }, [])
  const [voiceType, setVoiceType] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [isLoadingVoices, setIsLoadingVoices] = useState(true)

  // 当分类改变时，自动选择该分类下的第一个音色
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    const voicesInCategory = getVoicesByCategory(category)
    if (voicesInCategory.length > 0) {
      setVoiceType(voicesInCategory[0].id)
      // 重置情感选择
      setEmotion('none')
      setEnableEmotion(false)
    }
  }

  // 当音色改变时，重置情感选择
  const handleVoiceTypeChange = (newVoiceType: string) => {
    setVoiceType(newVoiceType)
    
    // 获取新音色的信息
    const newVoiceInfo = getVoiceInfo(newVoiceType)
    
    // 如果新音色不支持情感，或不支持当前选择的情感，则重置
    if (!newVoiceInfo?.emotions || newVoiceInfo.emotions.length === 0) {
      setEmotion('none')
      setEnableEmotion(false)
    } else if (emotion !== 'none' && !newVoiceInfo.emotions.includes(emotion)) {
      // 如果当前情感不在新音色支持的情感列表中，重置为none
      setEmotion('none')
    }
    // 如果新音色支持当前情感，保持不变
  }
  const [speedRatio, setSpeedRatio] = useState(1.0)
  const [encoding, setEncoding] = useState<string>('mp3')
  const [isLoading, setIsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  
  // 大模型新增参数
  const [emotion, setEmotion] = useState('none')
  const [enableEmotion, setEnableEmotion] = useState(false)
  const [emotionScale, setEmotionScale] = useState(4)
  const [rate, setRate] = useState(24000)
  const [loudnessRatio, setLoudnessRatio] = useState(1.0)
  const [withTimestamp, setWithTimestamp] = useState(false)
  const [textType, setTextType] = useState<'plain' | 'ssml'>('plain')
  const [silenceDuration, setSilenceDuration] = useState(0)
  const [operation, setOperation] = useState<'query' | 'submit'>('query')
  const [disableMarkdownFilter, setDisableMarkdownFilter] = useState(false)
  const [enableLatexTn, setEnableLatexTn] = useState(false)
  const [explicitLanguage, setExplicitLanguage] = useState('auto')
  
  // 试听功能状态
  const [playingVoice, setPlayingVoice] = useState<string>('')
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  
  // 文件命名选项
  const [usePreviewNaming, setUsePreviewNaming] = useState(false)

  // 示例文本
  const exampleTexts = [
    '你好，欢迎使用豆包大模型语音合成服务。',
    '今天天气真不错，适合出去散步。心情很好！',
    '人工智能技术正在改变我们的生活方式，未来充满无限可能。',
    '**加粗文本**和*斜体文本*的处理效果测试。',
    '<speak>这是<emphasis level="strong">SSML格式</emphasis>的文本示例。</speak>'
  ]

  // 情感映射（中文标签 -> 英文参数）
  const emotionMapping: Record<string, string> = {
    '无情感': 'none',
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
    '沮丧': 'depressed',
    '撒娇': 'lovey-dovey',
    '害羞': 'shy',
    '安慰鼓励': 'comfort',
    '咆哮/焦急': 'tension',
    '温柔': 'tender',
    '讲故事/自然讲述': 'storytelling',
    '情感电台': 'radio',
    '磁性': 'magnetic',
    '广告营销': 'advertising',
    '气泡音': 'vocal-fry',
    '低语(ASMR)': 'asmr',
    '新闻播报': 'news',
    '娱乐八卦': 'entertainment',
    '方言': 'dialect',
    '愉悦': 'happy',
    '兴奋': 'excited',
    '对话/闲聊': 'chat',
    '温暖': 'warm',
    '深情': 'affectionate',
    '权威': 'authoritative',
    'ASMR': 'asmr'
  }

  // 获取当前音色支持的情感选项
  const getCurrentVoiceEmotions = () => {
    const voiceInfo = getVoiceInfo(voiceType)
    if (!voiceInfo || !voiceInfo.emotions) {
      return [{ value: 'none', label: '无情感' }]
    }
    
    const options = [{ value: 'none', label: '无情感' }]
    voiceInfo.emotions.forEach(emotion => {
      const value = emotionMapping[emotion] || emotion.toLowerCase()
      // 查找中文标签
      let label = emotion
      for (const [cnLabel, enValue] of Object.entries(emotionMapping)) {
        if (enValue === value || enValue === emotion) {
          label = cnLabel
          break
        }
      }
      options.push({ value, label })
    })
    
    return options
  }

  const handleSynthesize = async () => {
    if (!text.trim()) {
      setError('请输入要合成的文本')
      return
    }

    if (!session) {
      setError('请先登录')
      return
    }

    setIsLoading(true)
    setError('')
    setAudioUrl('')
    setResult(null)

    try {
      const requestBody = {
        text,
        voiceType,
        speedRatio,
        encoding,
        format: 'base64',
        // 大模型参数
        emotion: enableEmotion && emotion !== 'none' ? emotion : undefined,
        enableEmotion,
        emotionScale: enableEmotion ? emotionScale : undefined,
        rate,
        loudnessRatio,
        withTimestamp,
        textType,
        silenceDuration: silenceDuration > 0 ? silenceDuration : undefined,
        operation,
        disableMarkdownFilter,
        enableLatexTn,
        explicitLanguage: explicitLanguage !== 'auto' ? explicitLanguage : undefined
      }

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '合成失败')
      }

      console.log('API 响应数据:', data) // 调试信息
      setResult(data)
      
      if (data.data && data.data.audio) {
        // 从 Base64 创建 Blob URL
        const audioData = data.data.audio
        const encoding = data.data.encoding || 'mp3'
        const mimeType = getMimeType(encoding)
        
        console.log('音频数据长度:', audioData.length, '编码:', encoding, 'MIME类型:', mimeType)
        
        // 将 Base64 转换为 Blob
        const binaryString = atob(audioData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        const blob = new Blob([bytes], { type: mimeType })
        const url = URL.createObjectURL(blob)
        
        console.log('创建的 Blob URL:', url, 'Blob大小:', blob.size) // 调试信息
        setAudioUrl(url)
        
        // 自动播放
        const audio = new Audio(url)
        audio.play().catch(err => {
          console.error('自动播放失败:', err)
        })
      } else {
        console.error('响应中没有音频数据:', data) // 调试信息
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = () => {
    if (!audioUrl) {
      console.error('没有音频 URL 可以下载')
      return
    }

    console.log('开始下载音频:', audioUrl) // 调试信息
    try {
      let fileName: string
      const voiceInfo = getVoiceInfo(voiceType)
      
      if (usePreviewNaming) {
        // 使用试听样本命名规则（不带时间戳）
        if (voiceInfo) {
          // 如果有情感，添加情感后缀
          if (enableEmotion && emotion && emotion !== 'neutral') {
            const emotionLabel = emotionLabels[emotion] || emotion
            fileName = `${voiceType}_${voiceInfo.name}_${emotionLabel}.${encoding}`
          } else {
            fileName = `${voiceType}_${voiceInfo.name}.${encoding}`
          }
        } else {
          fileName = `${voiceType}.${encoding}`
        }
      } else {
        // 原始命名规则（带时间戳）
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
        
        let baseFileName: string
        if (voiceInfo) {
          // 如果有情感，添加情感后缀
          if (enableEmotion && emotion && emotion !== 'neutral') {
            const emotionLabel = emotionLabels[emotion] || emotion
            baseFileName = `${voiceType}_${voiceInfo.name}_${emotionLabel}`
          } else {
            baseFileName = `${voiceType}_${voiceInfo.name}`
          }
        } else {
          baseFileName = voiceType
        }
        
        fileName = `${baseFileName}_${timestamp}.${encoding}`
      }
      
      // 清理文件名中的特殊字符
      fileName = fileName.replace(/[<>:"/\\|?*]/g, '_')
      
      const a = document.createElement('a')
      a.href = audioUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      console.log('下载完成，文件名:', fileName) // 调试信息
    } catch (err) {
      console.error('下载错误:', err) // 调试信息
      setError('下载失败')
    }
  }

  const loadExample = (exampleText: string) => {
    setText(exampleText)
    if (exampleText.includes('<speak>')) {
      setTextType('ssml')
    }
  }

  // 试听音色功能 - 使用OSS CDN
  const handlePlayVoiceDemo = async (voiceType: string, demoIndex: number = 0) => {
    const playKey = `${voiceType}-${demoIndex}`
    
    // 如果点击的是正在播放的音色，停止播放
    if (playingVoice === playKey) {
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
        setCurrentAudio(null)
      }
      setPlayingVoice('')
      return
    }
    
    // 停止之前的音频播放
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }
    
    // 设置新的播放状态
    setPlayingVoice(playKey)

    try {
      const voiceInfo = getVoiceInfo(voiceType)
      if (!voiceInfo) {
        console.warn(`找不到音色信息: ${voiceType}`)
        setPlayingVoice('')
        return
      }
      
      // 构建OSS CDN URL
      const OSS_DOMAIN = 'https://assets.lingflow.cn'
      let fileName: string
      
      // 获取demo信息
      const demoInfo = voiceInfo.demoUrls && voiceInfo.demoUrls[demoIndex] 
        ? voiceInfo.demoUrls[demoIndex] 
        : voiceInfo.demoUrls?.[0]
      
      if (demoInfo) {
        // 检查是否为日西语等特殊音色
        if (demoInfo.name && (
          /[\u3040-\u309f\u30a0-\u30ff]/.test(demoInfo.name) || // 日文
          demoInfo.name.includes('Javier') || 
          demoInfo.name.includes('Álvaro') ||
          demoInfo.name.includes('Roberto') ||
          demoInfo.name.includes('Esmeralda')
        )) {
          // 日西语音色：直接使用demo name作为文件名
          fileName = `${voiceType}_${demoInfo.name}`
        } else if (voiceInfo.demoUrls && voiceInfo.demoUrls.length > 1) {
          // 中英双语音色：直接使用demo的名称
          fileName = `${voiceType}_${demoInfo.name}`
        } else {
          // 单语音色：只用音色名
          fileName = `${voiceType}_${voiceInfo.name}`
        }
      } else {
        // 默认情况
        fileName = `${voiceType}_${voiceInfo.name}`
      }
      
      // 处理文件名（移除特殊字符）
      fileName = fileName.replace(/[<>:"/\\|?*]/g, '_')
      
      // 判断文件扩展名（日西语音色可能是wav）
      const ext = demoInfo?.url && demoInfo.url.includes('.wav') ? '.wav' : '.mp3'
      const demoUrl = `${OSS_DOMAIN}/tts_voice_demos/${fileName}${ext}`
      
      // 创建音频对象并播放
      const audio = new Audio(demoUrl)
      
      audio.onended = () => {
        // 播放结束后清理状态
        setPlayingVoice('')
        setCurrentAudio(null)
      }
      
      audio.onerror = () => {
        console.warn(`音色 ${voiceType} 的试听音频无法播放: ${demoUrl}`)
        setPlayingVoice('')
        setCurrentAudio(null)
      }
      
      // 保存当前音频实例
      setCurrentAudio(audio)
      
      await audio.play()
      console.log(`成功播放音色试听: ${voiceType} - ${demoUrl}`)
      
    } catch (error) {
      console.warn(`播放音色 ${voiceType} 试听失败:`, error)
      setPlayingVoice('')
      setCurrentAudio(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* 顶部装饰 */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-8">
          {/* 头部区域 */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="relative">
                <Mic className="w-12 h-12 text-blue-600" />
                <Sparkles className="w-6 h-6 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  豆包大模型 TTS 测试
                </h1>
                <p className="text-lg text-gray-300 mt-2">
                  体验火山引擎豆包大模型语音合成的强大功能
                </p>
              </div>
            </div>
            
            {/* 特性标签 */}
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              <span className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-full text-sm font-medium flex items-center gap-1 border border-blue-800">
                <Headphones className="w-4 h-4" />
                100+ 种音色
              </span>
              <span className="px-3 py-1 bg-purple-900/50 text-purple-300 rounded-full text-sm font-medium flex items-center gap-1 border border-purple-800">
                <Palette className="w-4 h-4" />
                情感合成
              </span>
              <span className="px-3 py-1 bg-green-900/50 text-green-300 rounded-full text-sm font-medium flex items-center gap-1 border border-green-800">
                <FileAudio className="w-4 h-4" />
                实时流式
              </span>
              <span className="px-3 py-1 bg-orange-900/50 text-orange-300 rounded-full text-sm font-medium flex items-center gap-1 border border-orange-800">
                <Settings className="w-4 h-4" />
                高度定制
              </span>
            </div>
          </div>

          {/* 主要内容区域 */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            {/* 文本输入区域 */}
            <div className="xl:col-span-2 space-y-3">
              <Card className="border border-gray-700 shadow-lg bg-gray-800/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-gray-100">
                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <Mic className="w-3.5 h-3.5 text-white" />
                    </div>
                    文本输入
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-base font-medium text-gray-200">要合成的文本</Label>
                      <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="请输入要转换为语音的文本..."
                        rows={4}
                        className="mt-2 resize-none border-2 border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 focus:border-blue-500 transition-colors duration-200"
                        maxLength={1024}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-sm font-medium ${text.length > 900 ? 'text-orange-400' : 'text-gray-400'}`}>
                          {text.length} / 1024 字符
                        </span>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${text.length > 0 ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                          <span className="text-xs text-gray-400">
                            {text.length > 0 ? '已输入' : '待输入'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 示例文本按钮 */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-300">快速示例</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {exampleTexts.slice(0, 3).map((example, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => loadExample(example)}
                            className="h-auto p-3 justify-start text-left bg-gray-700 border-gray-600 text-gray-200 hover:bg-blue-900/50 hover:border-blue-600 transition-colors"
                          >
                            <div>
                              <div className="font-medium text-xs text-gray-200">示例 {index + 1}</div>
                              <div className="text-xs text-gray-400 mt-1 truncate">
                                {example.substring(0, 20)}...
                              </div>
                            </div>
                          </Button>
                        ))}
                        {exampleTexts.slice(3).map((example, index) => (
                          <Button
                            key={index + 3}
                            variant="outline"
                            size="sm"
                            onClick={() => loadExample(example)}
                            className="h-auto p-3 justify-start text-left bg-gray-700 border-gray-600 text-gray-200 hover:bg-purple-900/50 hover:border-purple-600 transition-colors"
                          >
                            <div>
                              <div className="font-medium text-xs text-gray-200">
                                {index === 0 ? 'Markdown 示例' : 'SSML 示例'}
                              </div>
                              <div className="text-xs text-gray-400 mt-1 truncate">
                                {example.substring(0, 20)}...
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>

              {/* 音色选择区域 */}
              <Card className="border border-gray-700 shadow-lg bg-gray-800/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl text-gray-100">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <Headphones className="w-4 h-4 text-white" />
                    </div>
                    音色选择
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 音色分类选择 */}
                  <div>
                    <Label className="text-base font-medium text-gray-200 mb-4 block">音色分类</Label>
                    {isLoadingVoices ? (
                      <div className="flex items-center justify-center h-20">
                        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                        <span className="ml-2 text-sm text-gray-400">加载音色数据中...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {getVoiceCategories().map(category => (
                        <button
                          key={category}
                          onClick={() => handleCategoryChange(category)}
                          className={`p-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
                            selectedCategory === category
                              ? 'border-purple-500 bg-purple-900/50 text-purple-300'
                              : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-purple-400 hover:bg-purple-900/30'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                    )}
                  </div>

                  {/* 具体音色选择 */}
                  <div>
                    <Label className="text-base font-medium text-gray-200 mb-4 block">
                      具体音色 ({getVoicesByCategory(selectedCategory).length}个)
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {getVoicesByCategory(selectedCategory).map(voice => (
                        <div
                          key={voice.id}
                          onClick={() => handleVoiceTypeChange(voice.id)}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                            voiceType === voice.id
                              ? 'border-purple-500 bg-purple-900/50'
                              : 'border-gray-600 bg-gray-700 hover:border-purple-400 hover:bg-purple-900/30'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className={`font-medium text-sm ${
                                  voiceType === voice.id ? 'text-purple-300' : 'text-gray-200'
                                }`}>
                                  {voice.name}
                                </h3>
                                {/* 试听按钮 - 使用OSS CDN */}
                                {voice.demoUrls && voice.demoUrls.length > 0 && (
                                  <>
                                    {voice.demoUrls.map((demo, index) => {
                                      const playKey = `${voice.id}-${index}`
                                      return (
                                        <button
                                          key={index}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handlePlayVoiceDemo(voice.id, index)
                                          }}
                                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 ${
                                            playingVoice === playKey
                                              ? 'bg-green-500 text-white animate-pulse'
                                              : 'bg-gray-600 text-gray-300 hover:bg-blue-500 hover:text-white'
                                          }`}
                                          title={`试听: ${demo.name}`}
                                        >
                                          <PlayCircle className="w-3.5 h-3.5" />
                                        </button>
                                      )
                                    })}
                                  </>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {voice.language} • {voice.gender === 'male' ? '男声' : '女声'}
                                {voice.accent && ` • ${voice.accent}`}
                              </p>
                              <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                {voice.description}
                              </p>
                            </div>
                            {voiceType === voice.id && (
                              <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center ml-2 flex-shrink-0">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                          
                          {/* 显示支持的情感和特色功能 */}
                          {(voice.emotions || voice.features) && (
                            <div className="mt-3 space-y-2">
                              {voice.emotions && voice.emotions.length > 0 && (
                                <div>
                                  <span className="text-xs font-semibold text-purple-400 mb-1 block">情感支持：</span>
                                  <div className="flex flex-wrap gap-1">
                                    {voice.emotions.slice(0, 3).map(emotion => (
                                      <span key={emotion} className="px-2 py-1 bg-purple-900/50 text-purple-300 text-xs rounded-full border border-purple-600">
                                        {emotion}
                                      </span>
                                    ))}
                                    {voice.emotions.length > 3 && (
                                      <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded-full border border-gray-600">
                                        +{voice.emotions.length - 3}个
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              {voice.features && voice.features.length > 0 && (
                                <div>
                                  <span className="text-xs font-semibold text-pink-400 mb-1 block">特色功能：</span>
                                  <div className="flex flex-wrap gap-1">
                                    {voice.features.slice(0, 2).map((feature: string) => (
                                      <span key={feature} className="px-2 py-1 bg-pink-900/50 text-pink-300 text-xs rounded-full border border-pink-600">
                                        {feature}
                                      </span>
                                    ))}
                                    {voice.features.length > 2 && (
                                      <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded-full border border-gray-600">
                                        +{voice.features.length - 2}个
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 操作按钮区域 */}
              <Card className="border border-gray-700 shadow-lg bg-gray-800/80 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSynthesize}
                      disabled={isLoading || !text.trim()}
                      className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          合成中...
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5 mr-2" />
                          开始合成
                        </>
                      )}
                    </Button>

                    {audioUrl && (
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline"
                          onClick={handleDownload}
                          className="h-12 px-6 border-2 border-gray-600 bg-gray-700 text-gray-200 hover:border-green-500 hover:bg-green-900/50 transition-colors"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          下载
                        </Button>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="usePreviewNaming"
                            checked={usePreviewNaming}
                            onCheckedChange={(checked) => setUsePreviewNaming(!!checked)}
                            className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <label
                            htmlFor="usePreviewNaming"
                            className="text-sm text-gray-300 cursor-pointer select-none"
                          >
                            试听样本命名
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 错误提示 */}
              {error && (
                <Alert variant="destructive" className="border border-red-800 bg-red-900/50 border-l-4 border-l-red-500">
                  <AlertDescription className="text-red-300">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* 合成结果 */}
              {result && (
                <Card className="border border-green-800 shadow-lg bg-gradient-to-br from-green-900/30 to-emerald-900/30">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-green-300">
                      <Volume2 className="w-5 h-5" />
                      合成成功
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-400">状态：</span>
                        <span className="font-medium text-green-400">成功</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-400">时长：</span>
                        <span className="font-medium text-gray-200">{(result.data.duration / 1000).toFixed(2)} 秒</span>
                      </div>
                    </div>

                    {audioUrl && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-gray-200">音频播放器</Label>
                        <div className="p-3 bg-gray-700 rounded-lg border-2 border-green-700">
                          <audio
                            controls
                            src={audioUrl}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-400 mt-2 text-center">
                            音频链接有效期：5分钟
                          </p>
                        </div>
                      </div>
                    )}

                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-gray-300 hover:text-gray-100">
                        查看调试信息
                      </summary>
                      <div className="mt-2 p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-auto max-h-40">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 右侧参数配置面板 */}
            <div className="space-y-3">
              {/* 基础音频参数 */}
              <Card className="border border-gray-700 shadow-lg bg-gray-800/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-gray-100">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                      <Settings className="w-4 h-4 text-white" />
                    </div>
                    基础参数
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-gray-200">音频格式</Label>
                    <Select value={encoding} onValueChange={(value) => setEncoding(value)}>
                      <SelectTrigger className="mt-2 border-2 border-gray-600 bg-gray-700 text-gray-100 focus:border-orange-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            MP3 (推荐)
                          </div>
                        </SelectItem>
                        <SelectItem value="wav">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            WAV (无损)
                          </div>
                        </SelectItem>
                        <SelectItem value="pcm">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            PCM (原始)
                          </div>
                        </SelectItem>
                        <SelectItem value="ogg_opus">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            OGG Opus
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium text-gray-200">语速调节</Label>
                        <span className="text-sm font-semibold text-blue-400 bg-blue-900/50 px-2 py-1 rounded">
                          {speedRatio.toFixed(1)}x
                        </span>
                      </div>
                      <Slider
                        value={[speedRatio]}
                        onValueChange={([value]) => setSpeedRatio(value)}
                        min={0.8}
                        max={2.0}
                        step={0.1}
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0.8x</span>
                        <span>2.0x</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium text-gray-200">音量调节</Label>
                        <span className="text-sm font-semibold text-green-400 bg-green-900/50 px-2 py-1 rounded">
                          {loudnessRatio.toFixed(1)}x
                        </span>
                      </div>
                      <Slider
                        value={[loudnessRatio]}
                        onValueChange={([value]) => setLoudnessRatio(value)}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0.5x</span>
                        <span>2.0x</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-sm font-medium text-gray-200">采样率</Label>
                      <Select value={rate.toString()} onValueChange={(value) => setRate(parseInt(value))}>
                        <SelectTrigger className="mt-2 border-2 border-gray-600 bg-gray-700 text-gray-100 focus:border-orange-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="8000">8 kHz</SelectItem>
                          <SelectItem value="16000">16 kHz</SelectItem>
                          <SelectItem value="24000">24 kHz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-200">合成模式</Label>
                      <Select value={operation} onValueChange={(value: 'query' | 'submit') => setOperation(value)}>
                        <SelectTrigger className="mt-2 border-2 border-gray-600 bg-gray-700 text-gray-100 focus:border-orange-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="query">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              非流式
                            </div>
                          </SelectItem>
                          <SelectItem value="submit">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              流式
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>


              {/* 高级设置卡片 */}
              <Card className="border border-gray-700 shadow-lg bg-gray-800/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-gray-100">
                    <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center">
                      <FileAudio className="w-3.5 h-3.5 text-white" />
                    </div>
                    高级设置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-200">文本类型</Label>
                      <Select value={textType} onValueChange={(value: 'plain' | 'ssml') => setTextType(value)}>
                        <SelectTrigger className="mt-2 border-2 border-gray-600 bg-gray-700 text-gray-100 focus:border-indigo-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="plain">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                              普通文本
                            </div>
                          </SelectItem>
                          <SelectItem value="ssml">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                              SSML 标记
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-200">语种识别</Label>
                      <Select value={explicitLanguage} onValueChange={setExplicitLanguage}>
                        <SelectTrigger className="mt-2 border-2 border-gray-600 bg-gray-700 text-gray-100 focus:border-indigo-500">
                          <SelectValue placeholder="自动检测" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              自动检测
                            </div>
                          </SelectItem>
                          <SelectItem value="zh">中文为主</SelectItem>
                          <SelectItem value="en">仅英文</SelectItem>
                          <SelectItem value="ja">仅日文</SelectItem>
                          <SelectItem value="crosslingual">多语种混合</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-200">句尾静音时长 (毫秒)</Label>
                      <Input
                        type="number"
                        value={silenceDuration}
                        onChange={(e) => setSilenceDuration(parseInt(e.target.value) || 0)}
                        min={0}
                        max={30000}
                        className="mt-2 border-2 border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 focus:border-indigo-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                      <div className="flex items-center space-x-3">
                        <Switch
                          checked={withTimestamp}
                          onCheckedChange={setWithTimestamp}
                        />
                        <div>
                          <Label className="font-medium text-sm text-gray-200">返回时间戳</Label>
                          <p className="text-xs text-gray-400">精确的文本对应时间</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-purple-900/30 rounded-lg border border-purple-700">
                      <div className="flex items-center space-x-3">
                        <Switch
                          checked={disableMarkdownFilter}
                          onCheckedChange={setDisableMarkdownFilter}
                        />
                        <div>
                          <Label className="font-medium text-sm text-gray-200">禁用 Markdown 过滤</Label>
                          <p className="text-xs text-gray-400">保留 Markdown 格式符号</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-green-900/30 rounded-lg border border-green-700">
                      <div className="flex items-center space-x-3">
                        <Switch
                          checked={enableLatexTn}
                          onCheckedChange={setEnableLatexTn}
                        />
                        <div>
                          <Label className="font-medium text-sm text-gray-200">启用 LaTeX 公式</Label>
                          <p className="text-xs text-gray-400">数学公式语音播报</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 情感合成卡片 */}
              {getVoiceInfo(voiceType)?.emotions && getVoiceInfo(voiceType)?.emotions && getVoiceInfo(voiceType)!.emotions!.length > 0 && (
                <Card className="border border-gray-700 shadow-lg bg-gray-800/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg text-gray-100">
                      <div className="w-7 h-7 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      情感合成
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-pink-900/20 to-rose-900/20 rounded-lg border border-pink-700">
                      <div className="flex items-center space-x-3">
                        <Switch
                          checked={enableEmotion}
                          onCheckedChange={setEnableEmotion}
                        />
                        <div>
                          <Label className="font-medium text-sm text-gray-200">启用情感合成</Label>
                          <p className="text-xs text-gray-400">
                            支持 {getVoiceInfo(voiceType)?.emotions?.length || 0} 种情感
                          </p>
                        </div>
                      </div>
                    </div>

                    {enableEmotion && (
                      <div className="space-y-3 animate-in slide-in-from-top-3 duration-300">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-sm font-medium text-gray-300 mb-1.5 block">情感类型</Label>
                            <Select value={emotion} onValueChange={setEmotion}>
                              <SelectTrigger className="h-9 border-gray-600 bg-gray-700/50 text-gray-100 focus:border-pink-500">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getCurrentVoiceEmotions().map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${
                                        option.value === 'none' ? 'bg-gray-400' : 'bg-pink-500'
                                      }`}></div>
                                      {option.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <Label className="text-sm font-medium text-gray-300">情绪强度</Label>
                              <span className="text-xs font-semibold text-pink-400">
                                {emotionScale}
                              </span>
                            </div>
                            <Slider
                              value={[emotionScale]}
                              onValueChange={([value]) => setEmotionScale(value)}
                              min={1}
                              max={5}
                              step={1}
                              className="mt-2"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

          {/* 使用说明 */}
          <Card className="border border-gray-700 shadow-lg bg-gray-800/80 backdrop-blur-sm mt-3">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl text-gray-100">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                  <FileAudio className="w-4 h-4 text-white" />
                </div>
                使用说明
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 大模型特性 */}
                <div className="p-3 bg-gradient-to-br from-blue-900/30 to-indigo-900/30 rounded-xl border border-blue-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    <h3 className="font-semibold text-blue-300">大模型特性</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      支持情感合成，可设置开心、悲伤等情感
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      支持中英文混合，语言转换自然流畅
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      支持 SSML 标记语言增强控制
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      支持流式合成，可实时返回音频片段
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      提供 100+ 种音色，包括角色扮演、趣味口音等
                    </li>
                  </ul>
                </div>

                {/* 文本处理 */}
                <div className="p-3 bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-xl border border-purple-700">
                  <div className="flex items-center gap-2 mb-3">
                    <FileAudio className="w-5 h-5 text-purple-400" />
                    <h3 className="font-semibold text-purple-300">文本处理</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                      最大长度 1024 字符（建议小于300字符）
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                      支持 Markdown 语法解析（可禁用）
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                      支持 LaTeX 数学公式播报
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                      支持句尾静音时长调节
                    </li>
                  </ul>
                </div>

                {/* 音频参数 */}
                <div className="p-3 bg-gradient-to-br from-orange-900/30 to-red-900/30 rounded-xl border border-orange-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="w-5 h-5 text-orange-400" />
                    <h3 className="font-semibold text-orange-300">音频参数</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                      语速：0.8x - 2.0x
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                      音量：0.5x - 2.0x
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                      采样率：8000Hz / 16000Hz / 24000Hz
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                      格式：MP3 / WAV / PCM / OGG Opus
                    </li>
                  </ul>
                </div>

                {/* 音色分类 */}
                <div className="p-3 bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-xl border border-green-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Headphones className="w-5 h-5 text-green-400" />
                    <h3 className="font-semibold text-green-300">音色分类</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                      多情感：支持7种基础情感的表达
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                      角色扮演：动画角色如猴哥、熊二、佩奇等
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                      趣味口音：台湾、四川、广东等方言口音
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                      视频配音：解说、广告、故事等专业配音
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                      多语种：英语、日语、西语等国际化音色
                    </li>
                  </ul>
                </div>

                {/* 高级功能 */}
                <div className="p-3 bg-gradient-to-br from-teal-900/30 to-cyan-900/30 rounded-xl border border-teal-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Volume2 className="w-5 h-5 text-teal-400" />
                    <h3 className="font-semibold text-teal-300">高级功能</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mt-2 flex-shrink-0"></div>
                      时间戳：返回 TN 后文本的精确时间戳
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mt-2 flex-shrink-0"></div>
                      流式合成：WebSocket 实时返回音频数据
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mt-2 flex-shrink-0"></div>
                      多语种：支持中英日等多种语言
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mt-2 flex-shrink-0"></div>
                      缓存：相同文本可使用缓存加速
                    </li>
                  </ul>
                </div>

                {/* 技术特色 */}
                <div className="p-3 bg-gradient-to-br from-rose-900/30 to-pink-900/30 rounded-xl border border-rose-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Palette className="w-5 h-5 text-rose-400" />
                    <h3 className="font-semibold text-rose-300">技术特色</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-rose-400 rounded-full mt-2 flex-shrink-0"></div>
                      基于豆包大模型，语音质量更自然
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-rose-400 rounded-full mt-2 flex-shrink-0"></div>
                      WebSocket 二进制协议，低延迟传输
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-rose-400 rounded-full mt-2 flex-shrink-0"></div>
                      智能断句和韵律优化
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-rose-400 rounded-full mt-2 flex-shrink-0"></div>
                      音频格式自动优化和压缩
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  )
}