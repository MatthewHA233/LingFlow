'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Play } from 'lucide-react'

interface AlignmentResult {
  jobId: string
  status: string
  result?: any
  message?: string
  jobInfo?: any
}

export default function RevAITestPage() {
  const [audioUrl, setAudioUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AlignmentResult | null>(null)
  const [error, setError] = useState('')
  const [isPolling, setIsPolling] = useState(false)

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
          <h1 className="text-3xl font-bold mb-2">Rev AI 强制对齐测试</h1>
          <p className="text-gray-600">
            测试Rev AI的强制对齐功能，获取音频中每个单词的精确时间戳
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>输入参数</CardTitle>
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
              />
            </div>

            <div className="flex flex-wrap gap-2">
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
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
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
              {result.result && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">对齐结果 (完整JSON):</h4>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(result.result, null, 2)}
                    </pre>
                  </div>
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
      </div>
    </div>
  )
} 