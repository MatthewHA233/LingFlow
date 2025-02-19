'use client'

import Hyperspeed from '@/components/ui/hyperspeed'
import { hyperspeedPresets } from '@/components/ui/hyperspeed/presets'
import { useState, useEffect } from 'react'
import type { HyperspeedOptions } from '@/components/ui/hyperspeed'

export default function HyperspeedTest() {
  const [currentPreset, setCurrentPreset] = useState<keyof typeof hyperspeedPresets>('one')
  const [key, setKey] = useState(0)  // 添加 key 来强制重新渲染

  // 转换预设配置为正确的类型
  const getPresetOptions = (preset: keyof typeof hyperspeedPresets): Partial<HyperspeedOptions> => {
    const options = hyperspeedPresets[preset]
    return {
      ...options,
      lightStickWidth: options.lightStickWidth as [number, number],
      lightStickHeight: options.lightStickHeight as [number, number],
      movingAwaySpeed: options.movingAwaySpeed as [number, number],
      movingCloserSpeed: options.movingCloserSpeed as [number, number],
      carLightsLength: options.carLightsLength as [number, number],
      carLightsRadius: options.carLightsRadius as [number, number],
      carWidthPercentage: options.carWidthPercentage as [number, number],
      carShiftX: options.carShiftX as [number, number],
      carFloorSeparation: options.carFloorSeparation as [number, number],
    }
  }

  // 当预设改变时，强制组件重新渲染
  useEffect(() => {
    setKey(prev => prev + 1)
  }, [currentPreset])

  return (
    <div className="relative w-full h-screen bg-black">
      {/* 预设选择器 */}
      <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap max-w-[90vw]">
        {(Object.keys(hyperspeedPresets) as Array<keyof typeof hyperspeedPresets>).map((preset) => (
          <button
            key={preset}
            onClick={() => {
              console.log('切换到预设:', preset)  // 添加调试日志
              setCurrentPreset(preset)
            }}
            className={`px-4 py-2 rounded-md text-white transition-colors ${
              currentPreset === preset ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            预设 {preset}
          </button>
        ))}
      </div>

      {/* 提示文本 */}
      <div className="absolute bottom-4 left-4 z-10 text-white/70 text-sm">
        按住鼠标左键加速，松开恢复正常速度
      </div>

      {/* 当前预设信息 */}
      <div className="absolute bottom-4 right-4 z-10 text-white/70 text-sm">
        当前预设: {currentPreset}
      </div>

      {/* Hyperspeed 效果 */}
      <Hyperspeed
        key={key}  // 添加 key 来强制重新渲染
        effectOptions={{
          ...getPresetOptions(currentPreset),
          onSpeedUp: () => {
            console.log('加速中...', currentPreset)  // 添加当前预设信息到日志
          },
          onSlowDown: () => {
            console.log('减速中...', currentPreset)  // 添加当前预设信息到日志
          },
        }}
      />
    </div>
  )
}

