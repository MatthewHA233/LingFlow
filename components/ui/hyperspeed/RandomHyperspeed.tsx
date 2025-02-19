'use client'

import { useEffect, useState } from 'react'
import Hyperspeed from '.'
import { hyperspeedPresets } from './presets'
import type { HyperspeedOptions } from '.'

// 获取随机预设
const getRandomPreset = (): keyof typeof hyperspeedPresets => {
  const presets = Object.keys(hyperspeedPresets) as Array<keyof typeof hyperspeedPresets>
  const randomIndex = Math.floor(Math.random() * presets.length)
  return presets[randomIndex]
}

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

export default function RandomHyperspeed() {
  const [currentPreset] = useState(getRandomPreset)

  useEffect(() => {
    const handleMouseDown = () => {
      console.log('加速中...', currentPreset)
    }

    const handleMouseUp = () => {
      console.log('减速中...', currentPreset)
    }

    // 添加全局事件监听
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mouseleave', handleMouseUp)

    return () => {
      // 清理事件监听
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mouseleave', handleMouseUp)
    }
  }, [currentPreset])

  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <Hyperspeed
        effectOptions={{
          ...getPresetOptions(currentPreset),
          onSpeedUp: () => {},
          onSlowDown: () => {},
        }}
      />
    </div>
  )
} 