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
  return (
    <div className="p-2 md:p-3 w-[300px] md:w-[540px] max-w-[95vw]">
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
      
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        {models.map(model => (
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
              <div className="flex-shrink-0 mr-2 md:mr-2.5">
                <Image 
                  src={model.iconSrc} 
                  alt={model.provider} 
                  width={24} 
                  height={24} 
                  className="w-5 h-5 md:w-7 md:h-7 rounded-full"
                />
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
        ))}
      </div>
    </div>
  );
} 