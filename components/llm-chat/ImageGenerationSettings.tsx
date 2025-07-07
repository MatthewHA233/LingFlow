import React, { useState, useEffect, useRef } from 'react';
import { X, Image as ImageIcon, Palette, FileImage, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ImageGenerationSettings {
  size: '1024x1024' | '1536x1024' | '1024x1536' | '1792x1024' | '1024x1792' | '768x1344' | '1344x768' | '896x1152' | '1152x896' | '640x1536' | '1536x640';
  quality: 'low' | 'medium' | 'high' | 'auto';
  style: 'natural' | 'vivid';
  outputFormat: 'png' | 'jpeg' | 'webp';
  compression: number;
}

interface ImageGenerationSettingsProps {
  settings: ImageGenerationSettings;
  onChange: (settings: ImageGenerationSettings) => void;
  onClose: () => void;
  isVipModel?: boolean;
}

const sizeOptions = [
  // 正方形
  { value: '1024x1024', label: '1024×1024 (正方形 1:1)' },
  { value: '896x1152', label: '896×1152 (竖版 7:9)' },
  { value: '1152x896', label: '1152×896 (横版 9:7)' },
  
  // 标准横向 (16:9 类似)
  { value: '1792x1024', label: '1792×1024 (横版 16:9)' },
  { value: '1536x1024', label: '1536×1024 (横版 3:2)' },
  { value: '1344x768', label: '1344×768 (横版 16:9)' },
  
  // 标准纵向 (9:16 类似)
  { value: '1024x1792', label: '1024×1792 (竖版 9:16)' },
  { value: '1024x1536', label: '1024×1536 (竖版 2:3)' },
  { value: '768x1344', label: '768×1344 (竖版 9:16)' },
  
  // 超宽/超高
  { value: '1536x640', label: '1536×640 (超宽 21:9)' },
  { value: '640x1536', label: '640×1536 (超高 9:21)' }
];

const qualityOptions = [
  { value: 'low', label: '低质量 (快速)' },
  { value: 'medium', label: '中等质量' },
  { value: 'high', label: '高质量' },
  { value: 'auto', label: '自动' }
];

const styleOptions = [
  { value: 'natural', label: '自然风格' },
  { value: 'vivid', label: '生动风格' }
];

const formatOptions = [
  { value: 'png', label: 'PNG (无损)' },
  { value: 'jpeg', label: 'JPEG (有损)' },
  { value: 'webp', label: 'WebP (现代格式)' }
];

export function ImageGenerationSettingsDialog({
  settings,
  onChange,
  onClose,
  isVipModel = false
}: ImageGenerationSettingsProps) {
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [showFormatSelector, setShowFormatSelector] = useState(false);

  // 点击外部关闭所有下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // 如果点击的不是下拉菜单内部，关闭所有下拉菜单
      if (!target.closest('.selector-container')) {
        setShowSizeSelector(false);
        setShowQualitySelector(false);
        setShowStyleSelector(false);
        setShowFormatSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const renderSelector = (
    value: string,
    options: { value: string; label: string }[],
    selectorName: 'size' | 'quality' | 'style' | 'format',
    onSelect: (value: string) => void,
    icon?: React.ReactNode
  ) => {
    const selectedOption = options.find(opt => opt.value === value);
    
    // 根据选择器名称获取对应的状态
    const showSelector = 
      selectorName === 'size' ? showSizeSelector :
      selectorName === 'quality' ? showQualitySelector :
      selectorName === 'style' ? showStyleSelector :
      showFormatSelector;
    
    return (
      <div className="relative selector-container">
        <div 
          className="flex items-center justify-between p-2 md:p-2.5 bg-[#15192a] border border-white/10 rounded-lg cursor-pointer hover:bg-[#1a1f2e] hover:border-blue-500/30 transition-colors"
          onClick={() => {
            // 关闭所有选择器
            setShowSizeSelector(false);
            setShowQualitySelector(false);
            setShowStyleSelector(false);
            setShowFormatSelector(false);
            
            // 打开当前选择器
            if (selectorName === 'size') setShowSizeSelector(!showSizeSelector);
            else if (selectorName === 'quality') setShowQualitySelector(!showQualitySelector);
            else if (selectorName === 'style') setShowStyleSelector(!showStyleSelector);
            else if (selectorName === 'format') setShowFormatSelector(!showFormatSelector);
          }}
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs md:text-sm text-white">{selectedOption?.label}</span>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showSelector ? 'rotate-180' : ''}`} />
        </div>
        
        {showSelector && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-white/10 rounded-lg bg-[#0a0e14] shadow-xl z-50 overflow-hidden max-h-[300px] overflow-y-auto">
            {selectorName === 'size' ? (
              // 尺寸选择器特殊处理，显示分组
              <div>
                {/* 正方形 */}
                <div className="px-2 py-1 text-[10px] text-gray-500 bg-gray-800/50">正方形</div>
                <div
                  className={`p-2 md:p-2.5 text-xs md:text-sm cursor-pointer transition-colors ${
                    value === '1024x1024' 
                      ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500' 
                      : 'text-white hover:bg-white/5'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect('1024x1024');
                    setShowSizeSelector(false);
                  }}
                >
                  1024×1024 (正方形 1:1)
                </div>
                
                {/* 横版 */}
                <div className="px-2 py-1 text-[10px] text-gray-500 bg-gray-800/50">横版</div>
                {['1792x1024', '1536x1024', '1344x768', '1152x896'].map(size => {
                  const option = options.find(opt => opt.value === size);
                  return option ? (
                    <div
                      key={option.value}
                      className={`p-2 md:p-2.5 text-xs md:text-sm cursor-pointer transition-colors ${
                        option.value === value 
                          ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500' 
                          : 'text-white hover:bg-white/5'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(option.value);
                        setShowSizeSelector(false);
                      }}
                    >
                      {option.label}
                    </div>
                  ) : null;
                })}
                
                {/* 竖版 */}
                <div className="px-2 py-1 text-[10px] text-gray-500 bg-gray-800/50">竖版</div>
                {['1024x1792', '1024x1536', '768x1344', '896x1152'].map(size => {
                  const option = options.find(opt => opt.value === size);
                  return option ? (
                    <div
                      key={option.value}
                      className={`p-2 md:p-2.5 text-xs md:text-sm cursor-pointer transition-colors ${
                        option.value === value 
                          ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500' 
                          : 'text-white hover:bg-white/5'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(option.value);
                        setShowSizeSelector(false);
                      }}
                    >
                      {option.label}
                    </div>
                  ) : null;
                })}
                
                {/* 超宽/超高 */}
                <div className="px-2 py-1 text-[10px] text-gray-500 bg-gray-800/50">超宽/超高</div>
                {['1536x640', '640x1536'].map(size => {
                  const option = options.find(opt => opt.value === size);
                  return option ? (
                    <div
                      key={option.value}
                      className={`p-2 md:p-2.5 text-xs md:text-sm cursor-pointer transition-colors ${
                        option.value === value 
                          ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500' 
                          : 'text-white hover:bg-white/5'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(option.value);
                        setShowSizeSelector(false);
                      }}
                    >
                      {option.label}
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              // 其他选择器正常显示
              options.map(option => (
                <div
                  key={option.value}
                  className={`p-2 md:p-2.5 text-xs md:text-sm cursor-pointer transition-colors ${
                    option.value === value 
                      ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500' 
                      : 'text-white hover:bg-white/5'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(option.value);
                    // 关闭选择器
                    setShowSizeSelector(false);
                    setShowQualitySelector(false);
                    setShowStyleSelector(false);
                    setShowFormatSelector(false);
                  }}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-3 md:p-5">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-sm md:text-base font-medium text-white flex items-center">
          <ImageIcon className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2 text-blue-400" />
          图片生成设置
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-gray-400 hover:text-white h-6 w-6 md:h-8 md:w-8"
        >
          <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </Button>
      </div>

      <div className="space-y-3 md:space-y-4">
        {/* 图片尺寸 */}
        <div>
          <label className="text-xs md:text-sm text-gray-300 block mb-1.5 md:mb-2">图片尺寸</label>
          {renderSelector(
            settings.size,
            sizeOptions,
            'size',
            (value) => onChange({ ...settings, size: value as any }),
            undefined
          )}
        </div>

        {/* 图片质量 */}
        <div>
          <label className="text-xs md:text-sm text-gray-300 block mb-1.5 md:mb-2">图片质量</label>
          {renderSelector(
            settings.quality,
            qualityOptions,
            'quality',
            (value) => onChange({ ...settings, quality: value as any }),
            undefined
          )}
        </div>

        {/* VIP模型专属功能 */}
        {isVipModel && (
          <>
            {/* 图片风格 */}
            <div>
              <label className="text-xs md:text-sm text-gray-300 block mb-1.5 md:mb-2 flex items-center">
                <Palette className="h-3 w-3 mr-1 text-purple-400" />
                图片风格 (VIP专属)
              </label>
              {renderSelector(
                settings.style,
                styleOptions,
                'style',
                (value) => onChange({ ...settings, style: value as any }),
                undefined
              )}
            </div>

            {/* 输出格式 */}
            <div>
              <label className="text-xs md:text-sm text-gray-300 block mb-1.5 md:mb-2 flex items-center">
                <FileImage className="h-3 w-3 mr-1 text-purple-400" />
                输出格式 (VIP专属)
              </label>
              {renderSelector(
                settings.outputFormat,
                formatOptions,
                'format',
                (value) => onChange({ ...settings, outputFormat: value as any }),
                undefined
              )}
            </div>

            {/* 压缩率 (仅对JPEG和WebP有效) */}
            {(settings.outputFormat === 'jpeg' || settings.outputFormat === 'webp') && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs md:text-sm text-gray-300">
                    压缩质量
                  </label>
                  <span className="text-xs md:text-sm text-blue-400 font-mono">{settings.compression}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5" 
                  value={settings.compression}
                  onChange={(e) => onChange({ ...settings, compression: parseInt(e.target.value) })}
                  className="w-full h-2 bg-[#15192a] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>最小</span>
                  <span>平衡</span>
                  <span>最佳</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* 保存按钮 */}
        <div className="flex justify-end pt-2">
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2"
            onClick={() => {
              onChange(settings);
              onClose();
            }}
          >
            保存设置
          </Button>
        </div>
      </div>
    </div>
  );
} 