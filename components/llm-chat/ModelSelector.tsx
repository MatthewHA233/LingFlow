import React from 'react';
import Image from 'next/image';
import { CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

interface ModelSelectorProps {
  models: LLMModel[];
  selectedModel: LLMModel;
  onSelect: (model: LLMModel) => void;
  onClose: () => void;
}

export function ModelSelector({ models, selectedModel, onSelect, onClose }: ModelSelectorProps) {
  // 获取模型日期标签和颜色
  const getModelDateLabel = (modelId: string): { date: string, color: string } | null => {
    const dateMapping: Record<string, { date: string, color: string }> = {
      // 2025年3月及以后 - 绿色
      'deepseek-v3': { date: '03/24', color: 'bg-green-500/30 text-green-300' },
      'deepseek-r1': { date: '05/28', color: 'bg-green-500/30 text-green-300' },
      'claude-sonnet-4': { date: '05/14', color: 'bg-green-500/30 text-green-300' },
      'claude-opus-4': { date: '05/14', color: 'bg-green-500/30 text-green-300' },
      'claude-sonnet-4-thinking': { date: '05/14', color: 'bg-green-500/30 text-green-300' },
      'gemini-2.5-flash': { date: '05/20', color: 'bg-green-500/30 text-green-300' },
      'gemini-2.5-flash-thinking': { date: '05/20', color: 'bg-green-500/30 text-green-300' },
      'gemini-2.5-pro': { date: '06/05', color: 'bg-blue-500/30 text-green-300' },

      // 2025年2月 - 蓝绿色
      'grok-3': { date: '02/25', color: 'bg-teal-500/30 text-teal-300' },
      'grok-3-deepsearch': { date: '02/25', color: 'bg-teal-500/30 text-teal-300' },
      'grok-3-reasoner': { date: '02/25', color: 'bg-teal-500/30 text-teal-300' },
      
      // 2025年1月到2月初 - 蓝色 text-blue-300

      
      // 2024年的模型 - 灰色
      'gpt-4o': { date: '24.08', color: 'bg-gray-500/30 text-gray-300' },
      'gpt-4o-mini': { date: '24.08', color: 'bg-gray-500/30 text-gray-300' }
    };
    
    return dateMapping[modelId] || null;
  };

  return (
    <div className="p-2 md:p-3 w-[300px] md:w-[700px] max-w-[95vw]">
      <div className="flex items-center justify-between mb-1.5 md:mb-2">
        <h3 className="text-xs md:text-sm font-medium text-white">选择AI模型</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-gray-400 hover:text-white h-5 w-5 md:h-6 md:w-6"
        >
          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
        </Button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
        {models.map(model => {
          const dateInfo = getModelDateLabel(model.id);
          
          return (
            <div
              key={model.id}
              className={`p-2 md:p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                selectedModel.id === model.id
                  ? 'bg-blue-600/20 border border-blue-500/30'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
              onClick={() => onSelect(model)}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0 mr-2 md:mr-2.5 relative">
                  <Image 
                    src={model.iconSrc} 
                    alt={model.provider} 
                    width={24} 
                    height={24} 
                    className="w-5 h-5 md:w-7 md:h-7 rounded-full"
                  />
                  {dateInfo && (
                    <span className={`absolute -bottom-2.5 text-[8px] ${dateInfo.color} px-1 rounded-sm leading-tight`}>
                      {dateInfo.date}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <h4 className="text-[10px] md:text-xs font-medium text-white truncate">{model.displayName}</h4>
                    {model.id === selectedModel.id && (
                      <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3 text-blue-500 ml-1 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] md:text-xs text-gray-400 leading-tight">{model.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 