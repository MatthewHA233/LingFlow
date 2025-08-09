// 新的试听音色功能 - 完全使用CSV中的URL
export const handlePlayVoiceDemoNew = async (
  voiceType: string,
  demoUrl: string | undefined,
  playingVoice: string,
  setPlayingVoice: (value: string) => void,
  currentAudio: HTMLAudioElement | null,
  setCurrentAudio: (value: HTMLAudioElement | null) => void
) => {
  const playKey = `${voiceType}-${demoUrl || 'default'}`
  
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
  
  // 如果没有URL，直接返回
  if (!demoUrl) {
    console.warn(`音色 ${voiceType} 没有试听URL`)
    return
  }
  
  // 设置新的播放状态
  setPlayingVoice(playKey)

  try {
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