'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Play, TestTube, ArrowLeft, Target, Database } from 'lucide-react'

interface AlignmentResult {
  jobId: string
  status: string
  result?: any
  message?: string
  jobInfo?: any
}

interface DebugData {
  originalText: string
  cleanedText: string
  sentences: string[]
  revAIElements: any[]
  // 添加完整的Rev AI原始返回数据
  fullRevAIResponse?: any
  alignmentResult: Array<{
    id: number
    text: string
    startTime: number
    endTime: number
    words: Array<{
      text: string
      startTime: number
      endTime: number
      confidence: number
    }>
  }>
  audioUrl: string
  processedAt: string
  rawOriginalText: string
  selectedBlocksInfo: Array<{
    id: string
    type: string
    content: string
    contentLength: number
  }>
  // 添加数据库结果数据
  databaseResults?: Array<{
    blockId: string
    blockType: string
    blockIndex: number
    originalContent: string
    cleanedContent: string
    sentenceCount: number
    totalWords: number
    sentences: Array<{
      sentenceId: string
      sentenceText: string
      sentenceOrder: number
      beginTime: number
      endTime: number
      words: Array<{
        word: string
        startTime: number
        endTime: number
        confidence: number
      }>
      wordCount: number
    }>
    blockBeginTime: number
    blockEndTime: number
  }>
}

export default function RevAITestPage() {
  const [audioUrl, setAudioUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AlignmentResult | null>(null)
  const [error, setError] = useState('')
  const [isPolling, setIsPolling] = useState(false)
  const [debugData, setDebugData] = useState<DebugData | null>(null)
  const [isDebugMode, setIsDebugMode] = useState(false)

  // 检查是否有调试数据需要显示
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const isDebug = urlParams.get('debug') === 'true'
    const dataKey = urlParams.get('dataKey')
    
    if (isDebug && dataKey) {
      console.log('🧪 调试模式：尝试读取数据，dataKey:', dataKey)
      
      const storedDebugData = localStorage.getItem(dataKey)
      if (storedDebugData) {
        try {
          const parsedData = JSON.parse(storedDebugData)
          setDebugData(parsedData)
          setIsDebugMode(true)
          
          console.log('🧪 调试模式：成功解析数据:', parsedData)
          
          // 模拟Rev AI的返回格式来复用现有的显示逻辑
          const mockResult: AlignmentResult = {
            jobId: 'debug-mode',
            status: 'transcribed',
            result: {
              monologues: [{
                elements: [
                  ...parsedData.alignmentResult.flatMap((sentence: any) => 
                    sentence.words.map((word: any) => ({
                      type: 'text',
                      value: word.text,
                      ts: word.startTime,
                      end_ts: word.endTime,
                      confidence: word.confidence
                    }))
                  )
                ]
              }]
            }
          }
          
          setResult(mockResult)
          setAudioUrl(parsedData.audioUrl)
          setTranscript(parsedData.originalText)
          
          console.log('🧪 调试模式：已设置所有状态')
          
          // 清理localStorage中的临时数据（可选）
          setTimeout(() => {
            localStorage.removeItem(dataKey)
            console.log('🧪 调试模式：已清理临时数据')
          }, 5000)
          
        } catch (error) {
          console.error('🧪 调试模式：解析数据失败:', error)
          setError('调试数据解析失败')
        }
      } else {
        console.error('🧪 调试模式：未找到调试数据，dataKey:', dataKey)
        setError('未找到调试数据')
      }
    } else if (isDebug) {
      console.error('🧪 调试模式：缺少dataKey参数')
      setError('调试模式缺少必要参数')
    }
  }, [])

  // 示例数据
  const exampleData = {
    audioUrl: 'https://lingflow.oss-cn-heyuan.aliyuncs.com/audio/da36e93b-ff82-4b7d-97bd-41c8c99c63c2/1752328111628_01.wav',
    transcript: 'Once when I was six years old I saw a magnificent picture in a book, called True Stories from Nature, about the primeval forest.'
  }

  const handleSubmit = async () => {
    if (!audioUrl || !transcript) {
      setError('请提供音频URL和文本转录')
      return
    }

    setIsLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/rev-ai-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl,
          transcript
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '请求失败')
      }

      setResult(data)
      
      // 开始轮询任务状态
      if (data.jobId) {
        pollJobStatus(data.jobId)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setIsLoading(false)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    setIsPolling(true)
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/rev-ai-test?jobId=${jobId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || '获取状态失败')
        }

        setResult(data)

        if (data.status === 'completed') {
          setIsPolling(false)
          return
        }

        if (data.status === 'failed') {
          setError('任务处理失败')
          setIsPolling(false)
          return
        }

        // 继续轮询
        setTimeout(poll, 3000) // 每3秒检查一次
      } catch (err) {
        setError(err instanceof Error ? err.message : '轮询状态失败')
        setIsPolling(false)
      }
    }

    poll()
  }

  const loadExample = () => {
    setAudioUrl(exampleData.audioUrl)
    setTranscript(exampleData.transcript)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        <div className="text-center">
          {isDebugMode ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-4">
                <TestTube className="w-8 h-8 text-purple-600" />
                <h1 className="text-3xl font-bold text-purple-600">对齐结果调试视图</h1>
              </div>
              <p className="text-gray-600 mb-4">
                来自 AudioProcessingPanel 的实时对齐结果展示
              </p>
              {debugData && (
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-4 mb-4">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    处理时间: {new Date(debugData.processedAt).toLocaleString('zh-CN')}
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    句子数量: {debugData.sentences.length} | 单词数量: {debugData.revAIElements.length}
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    对齐结果: {debugData.alignmentResult.length} 个句子段落
                  </p>
                  <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded text-xs">
                    <p className="font-medium mb-1">原始文本长度: {debugData.originalText.length} 字符</p>
                    <p className="text-gray-600 dark:text-gray-400 truncate">
                      {debugData.originalText.substring(0, 100)}...
                    </p>
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => window.close()}
                className="mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                关闭调试窗口
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold mb-2">Rev AI 强制对齐测试</h1>
              <p className="text-gray-600">
                测试Rev AI的强制对齐功能，获取音频中每个单词的精确时间戳
              </p>
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {isDebugMode ? '对齐输入数据' : '输入参数'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                音频URL
              </label>
              <Input
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="输入音频文件的URL (支持 .wav, .mp3, .m4a 等格式)"
                className="w-full"
                readOnly={isDebugMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                文本转录
              </label>
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="输入对应的英文文本转录"
                rows={4}
                className="w-full"
                readOnly={isDebugMode}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {!isDebugMode && (
                <>
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading || isPolling}
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {isLoading ? '提交中...' : '开始强制对齐'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={loadExample}
                    disabled={isLoading || isPolling}
                  >
                    加载示例数据
                  </Button>
                </>
              )}
              
              {isDebugMode && (
                <div className="w-full bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                    ✅ 对齐已完成，以下是处理结果的详细展示
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 调试模式专用：显示我们的对齐数据 */}
        {isDebugMode && debugData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5 text-purple-600" />
                AudioProcessingPanel 对齐数据
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">原始数据</h4>
                  <div className="text-sm space-y-1">
                    <p>原始文本长度: {debugData.originalText.length}</p>
                    <p>划分句子数: {debugData.sentences.length}</p>
                    <p>Rev AI单词数: {debugData.revAIElements.length}</p>
                  </div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">对齐结果</h4>
                  <div className="text-sm space-y-1">
                    <p>对齐句子数: {debugData.alignmentResult.length}</p>
                    <p>总单词数: {debugData.alignmentResult.reduce((sum, s) => sum + s.words.length, 0)}</p>
                    <p>平均每句: {(debugData.alignmentResult.reduce((sum, s) => sum + s.words.length, 0) / debugData.alignmentResult.length).toFixed(1)} 词</p>
                  </div>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">时间范围</h4>
                  <div className="text-sm space-y-1">
                    <p>开始时间: {(debugData.alignmentResult[0]?.startTime || 0).toFixed(3)}s</p>
                    <p>结束时间: {(debugData.alignmentResult[debugData.alignmentResult.length - 1]?.endTime || 0).toFixed(3)}s</p>
                    <p>总时长: {((debugData.alignmentResult[debugData.alignmentResult.length - 1]?.endTime || 0) - (debugData.alignmentResult[0]?.startTime || 0)).toFixed(3)}s</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <h4 className="font-medium mb-2">句子划分预览</h4>
                <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                  {debugData.sentences.slice(0, 5).map((sentence, index) => (
                    <p key={index} className="text-gray-700 dark:text-gray-300">
                      {index + 1}. {sentence}
                    </p>
                  ))}
                  {debugData.sentences.length > 5 && (
                    <p className="text-gray-500 italic">... 还有 {debugData.sentences.length - 5} 个句子</p>
                  )}
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2">完整文本对比</h4>
                <div className="space-y-4">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">原始文本 ({debugData.rawOriginalText.length} 字符):</h5>
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border text-xs max-h-40 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                        {debugData.rawOriginalText}
                      </pre>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">清理后文本 ({debugData.cleanedText.length} 字符):</h5>
                    <div className="bg-blue-100 dark:bg-blue-950/20 p-3 rounded border text-xs max-h-40 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-blue-800 dark:text-blue-200">
                        {debugData.cleanedText}
                      </pre>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p>文本缩减: {debugData.rawOriginalText.length} → {debugData.cleanedText.length} 字符</p>
                    <p>缩减比例: {((1 - debugData.cleanedText.length / debugData.rawOriginalText.length) * 100).toFixed(1)}%</p>
                    <p>Rev AI返回单词数: {debugData.revAIElements.length}</p>
                    <p>预期单词数: 约 {Math.round(debugData.cleanedText.split(' ').length)}</p>
                    <p>单词匹配率: {((debugData.revAIElements.length / debugData.cleanedText.split(' ').length) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2">选中的语境块 ({debugData.selectedBlocksInfo.length} 个)</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {debugData.selectedBlocksInfo.map((block, index) => (
                    <div key={block.id} className="bg-gray-100 dark:bg-gray-800 p-3 rounded border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          块 {index + 1} (ID: {block.id})
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          类型: {block.type} | 长度: {block.contentLength}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 max-h-20 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">
                          {block.content.substring(0, 200)}
                          {block.content.length > 200 && '...'}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 新增：处理流程分析 */}
        {debugData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                处理流程分析：语境块 → 句子 → 单词
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 第一步：语境块分析 */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-medium text-blue-800 mb-3">第一步：语境块处理</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-100 dark:bg-blue-950/20 p-3 rounded">
                    <h5 className="text-sm font-medium mb-2">输入统计</h5>
                    <ul className="text-sm space-y-1">
                      <li>• 选中语境块数量: {debugData.selectedBlocksInfo.length}</li>
                      <li>• 原始文本总长度: {debugData.rawOriginalText.length} 字符</li>
                      <li>• 清理后文本长度: {debugData.cleanedText.length} 字符</li>
                      <li>• 文本压缩率: {((1 - debugData.cleanedText.length / debugData.rawOriginalText.length) * 100).toFixed(1)}%</li>
                    </ul>
                  </div>
                  <div className="bg-blue-100 dark:bg-blue-950/20 p-3 rounded">
                    <h5 className="text-sm font-medium mb-2">语境块详情</h5>
                    <div className="text-xs space-y-1 max-h-24 overflow-y-auto">
                      {debugData.selectedBlocksInfo.map((block, idx) => (
                        <div key={block.id}>
                          块{idx + 1}: {block.type} ({block.contentLength}字符)
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 第二步：句子划分 */}
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-medium text-green-800 mb-3">第二步：句子划分</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-100 dark:bg-green-950/20 p-3 rounded">
                    <h5 className="text-sm font-medium mb-2">划分统计</h5>
                    <ul className="text-sm space-y-1">
                      <li>• 划分句子数量: {debugData.sentences.length}</li>
                      <li>• 平均句子长度: {(debugData.cleanedText.length / debugData.sentences.length).toFixed(1)} 字符</li>
                      <li>• 预估单词数: ~{debugData.cleanedText.split(' ').length}</li>
                    </ul>
                  </div>
                  <div className="bg-green-100 dark:bg-green-950/20 p-3 rounded">
                    <h5 className="text-sm font-medium mb-2">句子预览</h5>
                    <div className="text-xs space-y-1 max-h-24 overflow-y-auto">
                      {debugData.sentences.slice(0, 3).map((sentence, idx) => (
                        <div key={idx} className="truncate">
                          {idx + 1}. {sentence.substring(0, 60)}...
                        </div>
                      ))}
                      {debugData.sentences.length > 3 && (
                        <div className="text-gray-500">...还有{debugData.sentences.length - 3}个句子</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 第三步：Rev AI处理 */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-medium text-purple-800 mb-3">第三步：Rev AI强制对齐</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-purple-100 dark:bg-purple-950/20 p-3 rounded">
                    <h5 className="text-sm font-medium mb-2">API响应统计</h5>
                    <ul className="text-sm space-y-1">
                      <li>• Rev AI返回单词数: {debugData.revAIElements.length}</li>
                      <li>• 单词匹配率: {((debugData.revAIElements.length / debugData.cleanedText.split(' ').length) * 100).toFixed(1)}%</li>
                      <li>• 响应数据大小: {debugData.fullRevAIResponse ? JSON.stringify(debugData.fullRevAIResponse).length.toLocaleString() : 'N/A'} 字符</li>
                    </ul>
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-950/20 p-3 rounded">
                    <h5 className="text-sm font-medium mb-2">时间范围</h5>
                    <ul className="text-sm space-y-1">
                      <li>• 开始时间: {debugData.revAIElements[0]?.ts?.toFixed(3) || 'N/A'}s</li>
                      <li>• 结束时间: {debugData.revAIElements[debugData.revAIElements.length - 1]?.end_ts?.toFixed(3) || 'N/A'}s</li>
                      <li>• 总时长: {debugData.revAIElements[0] && debugData.revAIElements[debugData.revAIElements.length - 1] ? 
                        (debugData.revAIElements[debugData.revAIElements.length - 1].end_ts - debugData.revAIElements[0].ts).toFixed(3) : 'N/A'}s</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 第四步：最终对齐结果 */}
              <div className="border-l-4 border-orange-500 pl-4">
                <h4 className="font-medium text-orange-800 mb-3">第四步：句子-单词对齐结果</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-orange-100 dark:bg-orange-950/20 p-3 rounded">
                    <h5 className="text-sm font-medium mb-2">对齐统计</h5>
                    <ul className="text-sm space-y-1">
                      <li>• 最终句子数: {debugData.alignmentResult.length}</li>
                      <li>• 总单词数: {debugData.alignmentResult.reduce((sum, s) => sum + s.words.length, 0)}</li>
                      <li>• 平均每句单词数: {(debugData.alignmentResult.reduce((sum, s) => sum + s.words.length, 0) / debugData.alignmentResult.length).toFixed(1)}</li>
                    </ul>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-950/20 p-3 rounded">
                    <h5 className="text-sm font-medium mb-2">质量指标</h5>
                    <ul className="text-sm space-y-1">
                      <li>• 句子覆盖率: {((debugData.alignmentResult.length / debugData.sentences.length) * 100).toFixed(1)}%</li>
                      <li>• 单词保留率: {((debugData.alignmentResult.reduce((sum, s) => sum + s.words.length, 0) / debugData.revAIElements.length) * 100).toFixed(1)}%</li>
                      <li>• 处理时间: {debugData.processedAt}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 关键问题诊断 */}
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <h4 className="font-medium text-red-800 mb-3">🔍 关键问题诊断</h4>
                <div className="space-y-2 text-sm">
                  {debugData.revAIElements.length < debugData.cleanedText.split(' ').length * 0.8 && (
                    <div className="text-red-700">
                      ⚠️ 单词匹配率过低 ({((debugData.revAIElements.length / debugData.cleanedText.split(' ').length) * 100).toFixed(1)}%)，可能存在API响应截断
                    </div>
                  )}
                  {debugData.alignmentResult.length < debugData.sentences.length * 0.9 && (
                    <div className="text-red-700">
                      ⚠️ 句子覆盖率不足 ({((debugData.alignmentResult.length / debugData.sentences.length) * 100).toFixed(1)}%)，部分句子未成功对齐
                    </div>
                  )}
                  {!debugData.fullRevAIResponse && (
                    <div className="text-red-700">
                      ⚠️ 缺少完整的Rev AI响应数据，无法进行深度分析
                    </div>
                  )}
                  {debugData.fullRevAIResponse && JSON.stringify(debugData.fullRevAIResponse).length < 10000 && (
                    <div className="text-red-700">
                      ⚠️ Rev AI响应数据异常小 ({JSON.stringify(debugData.fullRevAIResponse).length}字符)，可能存在数据截断
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                处理结果
                {isPolling && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">任务ID:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                    {result.jobId}
                  </code>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-medium">状态:</span>
                  <span className={`px-2 py-1 rounded text-sm ${
                    result.status === 'completed' 
                      ? 'bg-green-100 text-green-800' 
                      : result.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {result.status}
                  </span>
                </div>
              </div>

              {result.message && (
                <div>
                  <span className="font-medium">消息:</span>
                  <p className="text-gray-600">{result.message}</p>
                </div>
              )}

              {/* 显示任务信息 */}
              {result.jobInfo && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">任务信息:</h4>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(result.jobInfo, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* 显示对齐结果 */}
              {(debugData?.fullRevAIResponse || result.result) && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">
                    对齐结果 (完整JSON) 
                    {debugData?.fullRevAIResponse && (
                      <span className="text-sm text-green-600 ml-2">
                        [来自调试数据 - 完整响应]
                      </span>
                    )}
                  </h4>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(debugData?.fullRevAIResponse || result.result, null, 2)}
                    </pre>
                  </div>
                  
                  {debugData?.fullRevAIResponse && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p>数据大小: {JSON.stringify(debugData.fullRevAIResponse).length.toLocaleString()} 字符</p>
                      <p>包含单词数: {debugData.fullRevAIResponse.result?.monologues?.[0]?.elements?.filter((e: any) => e.type === 'text')?.length || 0}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 如果有对齐结果，显示简化的单词时间戳 */}
              {result.result && result.result.monologues && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">强制对齐结果 (按句子分组):</h4>
                  <div className="bg-blue-50 p-4 rounded-lg space-y-6">
                    {result.result.monologues.map((monologue: any, index: number) => (
                      <div key={index} className="space-y-4">
                        <div className="font-medium text-blue-800 mb-2">
                          说话者: {monologue.speaker || '未知'}
                        </div>
                        
                        {(() => {
                          // 将elements按句子分组
                          const sentences: any[] = []
                          let currentSentence: any[] = []
                          let sentenceStartTime: number | null = null
                          let sentenceEndTime: number | null = null
                          
                          monologue.elements.forEach((element: any) => {
                            if (element.type === 'text') {
                              if (sentenceStartTime === null) {
                                sentenceStartTime = element.ts
                              }
                              sentenceEndTime = element.end_ts
                              currentSentence.push(element)
                            } else if (element.type === 'punct') {
                              // 如果是句号、问号、感叹号，结束当前句子
                              if (element.value.includes('.') || element.value.includes('?') || element.value.includes('!')) {
                                if (currentSentence.length > 0) {
                                  sentences.push({
                                    words: [...currentSentence],
                                    startTime: sentenceStartTime,
                                    endTime: sentenceEndTime,
                                    text: currentSentence.map(w => w.value).join(' ')
                                  })
                                  currentSentence = []
                                  sentenceStartTime = null
                                  sentenceEndTime = null
                                }
                              }
                            }
                          })
                          
                          // 如果还有剩余的单词，作为最后一个句子
                          if (currentSentence.length > 0) {
                            sentences.push({
                              words: [...currentSentence],
                              startTime: sentenceStartTime,
                              endTime: sentenceEndTime,
                              text: currentSentence.map(w => w.value).join(' ')
                            })
                          }
                          
                          return sentences.map((sentence, sentenceIndex) => (
                            <div key={sentenceIndex} className="bg-white p-4 rounded-lg border border-blue-200">
                              <div className="mb-3">
                                <div className="font-medium text-gray-800 mb-1">
                                  句子 {sentenceIndex + 1}: &quot;{sentence.text}&quot;
                                </div>
                                <div className="text-sm text-gray-600">
                                  时间范围: {sentence.startTime?.toFixed(3)}s - {sentence.endTime?.toFixed(3)}s
                                  (时长: {((sentence.endTime || 0) - (sentence.startTime || 0)).toFixed(3)}s)
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-700">单词时间戳:</div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                  {sentence.words.map((word: any, wordIndex: number) => (
                                    <div key={wordIndex} className="text-xs bg-gray-50 p-2 rounded border">
                                      <div className="font-medium text-gray-800">{word.value}</div>
                                      <div className="text-gray-600">
                                        {word.ts?.toFixed(3)}s - {word.end_ts?.toFixed(3)}s
                                      </div>
                                      <div className="text-gray-500">
                                        时长: {((word.end_ts || 0) - (word.ts || 0)).toFixed(3)}s
                                      </div>
                                      {word.confidence && (
                                        <div className="text-blue-600 font-medium">
                                          {(word.confidence * 100).toFixed(1)}%
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <div>
              <strong>1. 音频要求:</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>支持的格式: .wav, .mp3, .m4a, .flac 等</li>
                <li>音频必须是可公开访问的URL</li>
                <li>建议音频质量清晰，语速适中</li>
              </ul>
            </div>
            
            <div>
              <strong>2. 文本要求:</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>必须是英文文本</li>
                <li>文本应该与音频内容完全匹配</li>
                <li>标点符号会影响对齐精度</li>
              </ul>
            </div>
            
            <div>
              <strong>3. 处理流程:</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>提交任务后会返回任务ID</li>
                <li>系统会自动轮询任务状态（每3秒检查一次）</li>
                <li>完成后显示完整的JSON结果和简化的单词时间戳</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 新增：数据库结果展示 */}
        {debugData?.databaseResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 w-5 text-blue-600" />
                数据库结果 (按语境块分组)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-100 dark:bg-blue-950/20 p-3 rounded">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">总体统计</h4>
                  <div className="text-sm space-y-1">
                    <p>语境块数量: {debugData.databaseResults.length}</p>
                    <p>总句子数: {debugData.databaseResults.reduce((sum, block) => sum + block.sentenceCount, 0)}</p>
                    <p>总单词数: {debugData.databaseResults.reduce((sum, block) => sum + block.totalWords, 0)}</p>
                  </div>
                </div>
                <div className="bg-green-100 dark:bg-green-950/20 p-3 rounded">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">时间范围</h4>
                  <div className="text-sm space-y-1">
                    <p>开始时间: {(debugData.databaseResults[0]?.blockBeginTime / 1000).toFixed(3)}s</p>
                    <p>结束时间: {(debugData.databaseResults[debugData.databaseResults.length - 1]?.blockEndTime / 1000).toFixed(3)}s</p>
                    <p>总时长: {((debugData.databaseResults[debugData.databaseResults.length - 1]?.blockEndTime - debugData.databaseResults[0]?.blockBeginTime) / 1000).toFixed(3)}s</p>
                  </div>
                </div>
                <div className="bg-purple-100 dark:bg-purple-950/20 p-3 rounded">
                  <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">平均指标</h4>
                  <div className="text-sm space-y-1">
                    <p>每块句子数: {(debugData.databaseResults.reduce((sum, block) => sum + block.sentenceCount, 0) / debugData.databaseResults.length).toFixed(1)}</p>
                    <p>每句单词数: {(debugData.databaseResults.reduce((sum, block) => sum + block.totalWords, 0) / debugData.databaseResults.reduce((sum, block) => sum + block.sentenceCount, 0)).toFixed(1)}</p>
                    <p>每块单词数: {(debugData.databaseResults.reduce((sum, block) => sum + block.totalWords, 0) / debugData.databaseResults.length).toFixed(1)}</p>
                  </div>
                </div>
              </div>

              {/* 按语境块展示详细内容 */}
              <div className="space-y-6">
                <h4 className="font-medium text-lg border-b pb-2">语境块详细分组</h4>
                {debugData.databaseResults.map((block, blockIndex) => (
                  <div key={block.blockId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
                    {/* 语境块头部信息 */}
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">
                          语境块 {blockIndex + 1} (ID: {block.blockId})
                        </h5>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {block.sentenceCount} 句子 | {block.totalWords} 单词 | {((block.blockEndTime - block.blockBeginTime) / 1000).toFixed(2)}s
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <p><strong>原始内容:</strong> {block.originalContent}</p>
                        <p><strong>清理后内容:</strong> {block.cleanedContent}</p>
                        <p><strong>时间范围:</strong> {(block.blockBeginTime / 1000).toFixed(3)}s - {(block.blockEndTime / 1000).toFixed(3)}s</p>
                      </div>
                    </div>

                    {/* 该语境块下的所有句子 */}
                    <div className="space-y-3">
                      <h6 className="font-medium text-gray-700 dark:text-gray-300">包含的句子:</h6>
                      {block.sentences.map((sentence, sentenceIndex) => (
                        <div key={sentence.sentenceId} className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded border">
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-blue-800 dark:text-blue-200">
                                句子 {sentence.sentenceOrder} (ID: {sentence.sentenceId})
                              </span>
                              <div className="text-xs text-blue-600 dark:text-blue-400">
                                {sentence.wordCount} 单词 | {((sentence.endTime - sentence.beginTime) / 1000).toFixed(3)}s
                              </div>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                              &ldquo;{sentence.sentenceText}&rdquo;
                            </p>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              时间: {(sentence.beginTime / 1000).toFixed(3)}s - {(sentence.endTime / 1000).toFixed(3)}s
                            </div>
                          </div>

                          {/* 该句子下的所有单词 */}
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">单词时间戳:</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1">
                              {sentence.words.map((word, wordIndex) => (
                                <div key={wordIndex} className="text-xs bg-white dark:bg-gray-800 p-2 rounded border">
                                  <div className="font-medium text-gray-800 dark:text-gray-200 truncate" title={word.word}>
                                    {word.word}
                                  </div>
                                  <div className="text-gray-600 dark:text-gray-400 text-[10px]">
                                    {(word.startTime || 0).toFixed(3)}s
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-500 text-[10px]">
                                    {((word.endTime || 0) - (word.startTime || 0)).toFixed(3)}s
                                  </div>
                                  {word.confidence && (
                                    <div className="text-blue-600 dark:text-blue-400 font-medium text-[10px]">
                                      {(word.confidence * 100).toFixed(0)}%
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 