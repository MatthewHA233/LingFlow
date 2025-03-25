import React from 'react';
import { X, Brain, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';

// 添加此类型定义
interface LLMModel {
  id: string;
  provider: string;
  name: string;
  displayName: string;
  description: string;
  iconSrc: string;
  maxTokens: number;
  temperature: number;
}

interface ChatSettings {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  defaultModelId: string;
}

interface ChatOptionsProps {
  settings: ChatSettings;
  onChange: (settings: ChatSettings) => void;
  onClose: () => void;
  availableModels: LLMModel[];
  selectedModel: LLMModel;
}

export function ChatOptions({ 
  settings, 
  onChange, 
  onClose,
  availableModels,
  selectedModel
}: ChatOptionsProps) {
  const [showModelSelector, setShowModelSelector] = React.useState(false);
  
  return (
    <div className="p-3 md:p-5">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-sm md:text-base font-medium text-white flex items-center">
          <Settings className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2 text-blue-400" />
          AI助手设置
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
      
      <div className="space-y-4 md:space-y-5">
        {/* 默认模型设置 */}
        <div>
          <label className="text-xs md:text-sm text-gray-300 block mb-1.5 md:mb-2">默认模型</label>
          <div 
            className="flex items-center p-1.5 md:p-2 bg-[#15192a] border border-white/10 rounded-lg cursor-pointer hover:bg-[#1a1f2e] hover:border-blue-500/30"
            onClick={() => setShowModelSelector(!showModelSelector)}
          >
            <div className="w-6 h-6 rounded-full mr-2 flex-shrink-0">
              <Image 
                src={availableModels.find(m => m.id === settings.defaultModelId)?.iconSrc || selectedModel.iconSrc} 
                alt="模型" 
                width={24} 
                height={24}
                className="rounded-full" 
              />
            </div>
            <div className="flex-1">
              <div className="text-sm text-white">
                {availableModels.find(m => m.id === settings.defaultModelId)?.displayName || selectedModel.displayName}
              </div>
              <div className="text-xs text-gray-400">
                {availableModels.find(m => m.id === settings.defaultModelId)?.description || selectedModel.description}
              </div>
            </div>
          </div>
          
          {/* 显示模型选择器 */}
          {showModelSelector && (
            <div className="mt-2 border border-white/10 rounded-lg bg-[#0a0e14] shadow-xl max-h-[300px] overflow-y-auto">
              {availableModels.map(model => (
                <div
                  key={model.id}
                  className={`p-2 flex items-center cursor-pointer ${
                    model.id === settings.defaultModelId 
                      ? 'bg-blue-600/20 border-l-2 border-blue-500' 
                      : 'hover:bg-white/5'
                  }`}
                  onClick={() => {
                    onChange({
                      ...settings,
                      defaultModelId: model.id
                    });
                    setShowModelSelector(false);
                  }}
                >
                  <div className="w-6 h-6 rounded-full mr-2 flex-shrink-0">
                    <Image 
                      src={model.iconSrc} 
                      alt={model.provider} 
                      width={24} 
                      height={24}
                      className="rounded-full" 
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-white">{model.displayName}</div>
                    <div className="text-xs text-gray-400 truncate">{model.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 温度设置 */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300">创造性 (Temperature)</label>
            <span className="text-sm text-blue-400 font-mono">{settings.temperature.toFixed(1)}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="2" 
            step="0.1" 
            value={settings.temperature}
            onChange={(e) => onChange({
              ...settings,
              temperature: parseFloat(e.target.value)
            })}
            className="w-full h-2 bg-[#15192a] rounded-full appearance-none cursor-pointer mt-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>精确</span>
            <span>平衡</span>
            <span>创造</span>
          </div>
        </div>
        
        {/* 最大Token设置 */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300">最大回复长度</label>
            <span className="text-sm text-blue-400 font-mono">{settings.maxTokens}</span>
          </div>
          <input 
            type="range" 
            min="100" 
            max="4000" 
            step="100" 
            value={settings.maxTokens}
            onChange={(e) => onChange({
              ...settings,
              maxTokens: parseInt(e.target.value)
            })}
            className="w-full h-2 bg-[#15192a] rounded-full appearance-none cursor-pointer mt-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>简短</span>
            <span>中等</span>
            <span>详细</span>
          </div>
        </div>
        
        {/* 系统提示词设置 */}
        <div>
          <label className="text-sm text-gray-300 block mb-2">系统提示词</label>
          <Textarea
            value={settings.systemPrompt}
            onChange={(e) => onChange({
              ...settings,
              systemPrompt: e.target.value
            })}
            className="w-full h-32 bg-[#15192a] border border-white/10 rounded-lg focus:border-blue-500/50 text-white text-sm p-3 resize-none"
            placeholder="设置AI助手的行为和角色..."
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.1) transparent'
            }}
          />
        </div>
        
        {/* 保存按钮 */}
        <div className="flex justify-end pt-2">
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
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