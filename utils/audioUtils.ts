interface AudioProcessResult {
  url: string
  duration: number
  transcription?: string
}

export async function processAudioFile(file: File): Promise<AudioProcessResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = () => {
      const audioUrl = URL.createObjectURL(file)
      const audio = new Audio(audioUrl)
      
      audio.onloadedmetadata = () => {
        // 模拟转写过程
        const mockTranscription = `这是 ${file.name} 的转写文本内容`
        
        resolve({
          url: audioUrl,
          duration: audio.duration,
          transcription: mockTranscription
        })
      }
      
      audio.onerror = () => {
        reject(new Error('无法加载音频文件'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('无法读取文件'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}