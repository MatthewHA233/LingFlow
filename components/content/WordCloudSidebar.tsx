import React, { useState, useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X, Send, Trash2, Eye, Loader2, CheckCircle, Sparkles, Database, Search, Zap, Star, FileText, Brain, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectedWord } from './AnchorWordBlock';
import { WordExplainer } from './WordExplainer';
import { useWordCollector, WordExplanation } from './WordCollector';
import { toast } from 'sonner';

// 处理阶段枚举 - 基于后端实际流程重新定义
type ProcessingStage = 
  | 'idle'
  | 'explaining'           // 阶段1：AI解释词汇
  | 'checking_anchors'     // 阶段2：查询/创建锚点
  | 'processing_meanings'  // 阶段3：处理含义（NEW直接创建，OLD需LLM辨析）
  | 'saving_data'          // 阶段4：保存到数据库
  | 'completed';          // 阶段5：完成

// 阶段配置类型
interface StageConfig {
  order: number;
  name: string;
  icon: React.ComponentType<any> | null;
  color: string;
  spinning?: boolean;
  pulsing?: boolean;
  bouncing?: boolean;
}

// 阶段配置 - 简化版本，移除分数和复杂状态
const STAGE_CONFIG: Record<ProcessingStage, StageConfig> = {
  idle: { order: 0, name: '待处理', icon: null, color: 'gray' },
  explaining: { order: 1, name: '解释词汇', icon: Loader2, color: 'blue', spinning: true },
  checking_anchors: { order: 2, name: '查询锚点', icon: Search, color: 'orange', pulsing: true },
  processing_meanings: { order: 3, name: '处理含义', icon: Brain, color: 'purple', bouncing: true },
  saving_data: { order: 4, name: '保存数据', icon: Database, color: 'indigo', pulsing: true },
  completed: { order: 5, name: '已完成', icon: CheckCircle, color: 'green' }
} as const;

// 词汇处理状态
interface WordProcessingState {
  wordId: string;
  stage: ProcessingStage;
  result?: 'new' | 'different_meaning' | 'merged' | 'example_added';
  isNewAnchor?: boolean;
  isOldAnchor?: boolean;
}

// 处理进度状态 - 简化版本
interface ProcessingProgress {
  stage: ProcessingStage;
  message: string;
  total: number; // 总的新词汇数量
}

interface WordCloudSidebarProps {
  selectedWords: SelectedWord[];
  isOpen: boolean;
  onClose: () => void;
  onWordsChange: (words: SelectedWord[]) => void;
  isAnchorMode?: boolean;
  currentBlocks?: Array<{
    id: string;
    block_type: string;
    content: string;
    original_content?: string;
  }>;
  contextBlockId?: string;
  onAnchorProcessed?: (results: {
    success: boolean;
    error?: string;
    processed: number;
    results: any[];
    anchors?: any[];
  }) => void;
}

// 简单的粒子背景组件 - 仅限于容器内
const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
  }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置canvas尺寸
    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 初始化粒子
    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < 60; i++) {  // 从30增加到60个粒子
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.8,  // 稍微增加移动速度
          vy: (Math.random() - 0.5) * 0.8,
          size: Math.random() * 3 + 1.5,    // 从2+1改为3+1.5，粒子更大
          opacity: Math.random() * 0.5 + 0.3  // 从0.3+0.1改为0.5+0.3，不透明度更高
        });
      }
    };

    initParticles();

    // 动画循环
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach(particle => {
        // 更新位置
        particle.x += particle.vx;
        particle.y += particle.vy;

        // 边界检测
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        // 绘制粒子
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
        ctx.fill();
      });

      // 绘制连线
      particlesRef.current.forEach((particle, i) => {
        particlesRef.current.slice(i + 1).forEach(otherParticle => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {  // 从100增加到120，更多连线
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * (1 - distance / 120)})`; // 从0.1增加到0.2，连线更明显
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
};

export function WordCloudSidebar({
  selectedWords,
  isOpen,
  onClose,
  onWordsChange,
  isAnchorMode = true,
  currentBlocks,
  contextBlockId,
  onAnchorProcessed
}: WordCloudSidebarProps) {
  
  const [showWordExplainer, setShowWordExplainer] = useState(false);
  const [wordExplanations, setWordExplanations] = useState<Map<string, WordExplanation>>(new Map());
  const [hasExplanations, setHasExplanations] = useState(false);
  const [fullExplanationContent, setFullExplanationContent] = useState<string>('');
  
  // 统一的进度管理状态 - 简化版本
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress>({
    stage: 'idle',
    message: '',
    total: 0
  });
  
  // 词汇级别的处理状态
  const [wordProcessingStates, setWordProcessingStates] = useState<Map<string, WordProcessingState>>(new Map());
  
  // 处理日志（仅用于调试）
  const [processingLogs, setProcessingLogs] = useState<Array<{
    word: string;
    type: 'anchor_creation' | 'meaning_duplicate_check';
    log: any;
    timestamp: Date;
  }>>([]);

  // 计算新词汇数量
  const newWordsCount = useMemo(() => {
    return selectedWords.filter(w => !w.isExisting).length;
  }, [selectedWords]);

  // 使用词汇收集器
  const { collectWords } = useWordCollector({
    selectedWords,
    currentBlocks,
    contextBlockId,
    onExplanationUpdate: (explanations) => {
      setWordExplanations(explanations);
    },
    onFullContentUpdate: (content) => {
      setFullExplanationContent(content);
      setHasExplanations(true);
    },
    onLoadingChange: (loading) => {
      if (loading) {
        // 开始解释阶段
        setProcessingProgress({
          stage: 'explaining',
          message: '正在解释词汇含义...',
          total: newWordsCount
        });
      } else {
        // 解释完成，进入下一阶段
        if (newWordsCount > 0) {
          setProcessingProgress(prev => ({
            ...prev,
            stage: 'checking_anchors',
            message: '解释完成，开始处理锚点...',
          }));
        }
      }
    },
    onAnchorProcessed: (results) => {
      handleAnchorProcessingComplete(results);
      if (onAnchorProcessed) {
        onAnchorProcessed(results);
      }
    },
    onProcessingLogUpdate: (logs) => {
      setProcessingLogs(prev => [...prev, ...logs]);
      updateProgressFromLogs(logs);
    }
  });

  // 根据处理日志更新进度 - 修复状态同步问题
  const updateProgressFromLogs = (newLogs: any[]) => {
    if (newWordsCount === 0) return;

    // 使用setTimeout确保状态已经更新后再计算进度
    setTimeout(() => {
      setProcessingLogs(currentLogs => {
        // 计算各阶段的完成情况
        const anchorCheckLogs = currentLogs.filter(log => log.type === 'anchor_creation');
        const meaningAnalysisLogs = currentLogs.filter(log => 
          log.type === 'meaning_duplicate_check' && log.log.decision
        );
        const saveLogs = currentLogs.filter(log => 
          log.type === 'meaning_duplicate_check' && log.log.action === 'saved'
        );

        console.log('🔍 进度统计:', {
          totalWords: newWordsCount,
          anchorChecks: anchorCheckLogs.length,
          meaningAnalyses: meaningAnalysisLogs.length,
          saves: saveLogs.length,
          allLogsCount: currentLogs.length
        });

        // 更新进度状态
        setProcessingProgress(prev => {
          let newStage = prev.stage;
          let newMessage = prev.message;

          if (saveLogs.length >= newWordsCount) {
            // 所有词汇保存完成
            newStage = 'completed';
            newMessage = `处理完成！成功创建 ${newWordsCount} 个词锚点`;
          } else if (saveLogs.length > 0) {
            // 正在保存阶段
            newStage = 'saving_data';
            newMessage = `正在保存数据...`;
          } else if (meaningAnalysisLogs.length >= newWordsCount) {
            // 含义处理全部完成，准备保存
            newStage = 'saving_data';
            newMessage = '含义处理完成，准备保存...';
          } else if (meaningAnalysisLogs.length > 0) {
            // 正在处理含义
            newStage = 'processing_meanings';
            newMessage = '正在处理含义...';
          } else if (anchorCheckLogs.length >= newWordsCount) {
            // 锚点查询全部完成，开始处理含义
            newStage = 'processing_meanings';
            newMessage = '锚点查询完成，开始处理含义...';
          } else if (anchorCheckLogs.length > 0) {
            // 正在查询锚点
            newStage = 'checking_anchors';
            newMessage = '正在查询锚点...';
          }

          console.log('🎯 阶段更新:', {
            from: prev.stage,
            to: newStage,
            message: newMessage
          });

          return {
            stage: newStage,
            message: newMessage,
            total: newWordsCount
          };
        });

        // 不修改日志，只是为了计算进度
        return currentLogs;
      });
    }, 0);

    // 更新词汇级别状态
    updateWordStatesFromLogs(newLogs);
  };

  // 更新词汇级别状态 - 重写版本，确保动画正确显示
  const updateWordStatesFromLogs = (logs: any[]) => {
    setWordProcessingStates(prev => {
      const newStates = new Map(prev);
      
      logs.forEach(log => {
        const word = selectedWords.find(w => w.text === log.word && !w.isExisting);
        if (!word) return;
        
        const currentState = newStates.get(word.id) || { wordId: word.id, stage: 'checking_anchors' };
          
          if (log.type === 'anchor_creation') {
          // 锚点查询完成 - 显示NEW/OLD状态并保持动画
            const isNewAnchor = log.log.action === 'created_new';
            const isOldAnchor = log.log.action === 'found_existing';
            
          newStates.set(word.id, {
              ...currentState,
            stage: 'checking_anchors',
            isNewAnchor,
            isOldAnchor
          });
          
          console.log(`🏷️ 锚点状态更新: ${log.word} - ${isNewAnchor ? 'NEW' : 'OLD'}`);
        } else if (log.type === 'meaning_duplicate_check' && log.log.decision) {
          // 含义处理完成
          let result: WordProcessingState['result'] = 'new';
          
          if (log.log.decision.includes('新锚点')) {
            result = 'new';
          } else if (log.log.decision.includes('重复含义')) {
            result = log.log.parsedResult?.mergedMeaning ? 'merged' : 'example_added';
          } else if (log.log.decision.includes('不同含义')) {
            result = 'different_meaning';
          }
          
          // 清除NEW/OLD标签，显示最终结果
          newStates.set(word.id, {
                ...currentState,
            stage: 'processing_meanings',
            result,
            isNewAnchor: false,
            isOldAnchor: false
          });
          
          console.log(`✅ 含义处理完成: ${log.word} - ${result}`);
        }
      });
      
      return newStates;
    });
  };

  // 处理锚点处理完成 - 简化版本
  const handleAnchorProcessingComplete = (results: any) => {
    // 为所有词汇设置最终状态
    setWordProcessingStates(prev => {
      const newStates = new Map(prev);
      selectedWords.forEach(word => {
        if (!word.isExisting) {
          const currentState = newStates.get(word.id);
          if (currentState && !currentState.result) {
            // 设置最终状态
            newStates.set(word.id, {
                ...currentState,
              result: 'new',
                isNewAnchor: false,
              isOldAnchor: false
              });
          }
        }
      });
      return newStates;
    });
    
    setProcessingProgress({
      stage: 'completed',
      message: `处理完成！成功创建 ${newWordsCount} 个词锚点`,
      total: newWordsCount
    });
    
    toast.success(`词锚点处理完成！成功创建 ${newWordsCount} 个锚点`, {
      description: '语境块数据已更新，锚点已生效',
      duration: 4000,
    });
    
    // 清除缓存
    if (contextBlockId) {
      import('@/lib/services/meaning-blocks-service').then(({ MeaningBlocksService }) => {
        MeaningBlocksService.clearCache(contextBlockId);
      }).catch(console.error);
    }
    
    // 2秒后重置到空闲状态
    setTimeout(() => {
      setProcessingProgress({
        stage: 'idle',
        message: '',
        total: 0
      });
    }, 2000);
  };

  // 处理收集词汇 - 简化版本
  const handleCollectWords = async () => {
    if (selectedWords.length === 0) {
      toast.error('请先选择要处理的词汇');
      return;
    }

    // 重置所有状态
    setProcessingLogs([]);
    setWordProcessingStates(new Map());
    setProcessingProgress({
      stage: 'explaining',
      message: '开始解释词汇...',
      total: newWordsCount
    });

    try {
      await collectWords();
    } catch (error) {
      console.error('处理词汇失败:', error);
      toast.error('处理失败，请重试');
      setProcessingProgress({
        stage: 'idle',
        message: '',
        total: 0
      });
    }
  };

  // 统计信息
  const stats = useMemo(() => {
    const newSelectedWords = selectedWords.filter(w => !w.isExisting);
    const wordCount = newSelectedWords.filter(w => w.type === 'word').length;
    const phraseCount = newSelectedWords.filter(w => w.type === 'phrase').length;
    
    const existingWords = selectedWords.filter(w => w.isExisting);
    const existingWordCount = existingWords.filter(w => w.type === 'word').length;
    const existingPhraseCount = existingWords.filter(w => w.type === 'phrase').length;
    
    return { 
      wordCount, 
      phraseCount, 
      total: newSelectedWords.length,
      existingWordCount,
      existingPhraseCount,
      existingTotal: existingWords.length
    };
  }, [selectedWords]);

  // 移除单个词
  const removeWord = (wordId: string) => {
    const word = selectedWords.find(w => w.id === wordId);
    if (word?.isExisting) return;
    
    const newWords = selectedWords.filter(w => w.id !== wordId);
    onWordsChange(newWords);
    
    setWordExplanations(prev => {
      const newMap = new Map(prev);
      newMap.delete(wordId);
      return newMap;
    });
    
    setWordProcessingStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(wordId);
      return newMap;
    });
  };

  // 清空所有词
  const clearAllWords = () => {
    const existingWords = selectedWords.filter(w => w.isExisting);
    const removedWordIds = selectedWords.filter(w => !w.isExisting).map(w => w.id);
    
    onWordsChange(existingWords);
    
    setWordExplanations(prev => {
      const newMap = new Map();
      existingWords.forEach(word => {
        const explanation = prev.get(word.id);
        if (explanation) {
          newMap.set(word.id, explanation);
        }
      });
      return newMap;
    });
    
    setWordProcessingStates(prev => {
      const newMap = new Map(prev);
      removedWordIds.forEach(wordId => {
        newMap.delete(wordId);
      });
      return newMap;
    });
    
    if (existingWords.length === 0) {
      setHasExplanations(false);
      setFullExplanationContent('');
    }
  };

  // 处理查看详情
  const handleViewDetails = () => {
    setShowWordExplainer(true);
  };

  // 获取阶段图标组件
  const getStageIcon = (stage: ProcessingStage) => {
    const config = STAGE_CONFIG[stage];
    if (!config.icon) return null;
    
    const IconComponent = config.icon;
    const className = cn(
      "w-4 h-4",
      config.spinning && "animate-spin",
      config.pulsing && "animate-pulse",
      config.bouncing && "animate-bounce",
      `text-${config.color}-500`
    );
    
    return <IconComponent className={className} />;
  };

  // 渲染进度指示器 - 优化版本
  const renderProgressIndicator = () => {
    if (processingProgress.stage === 'idle') return null;
    
    const stages: ProcessingStage[] = ['explaining', 'checking_anchors', 'processing_meanings', 'saving_data', 'completed'];
    const currentStageIndex = stages.indexOf(processingProgress.stage);
    const progress = ((currentStageIndex + 1) / stages.length) * 100;
    
    // 根据当前阶段获取描述
    const getStageDescription = (stage: ProcessingStage): string => {
      const descriptions = {
        'idle': '',
        'explaining': '🧠 AI正在深度分析词汇语义和上下文含义',
        'checking_anchors': '🔍 智能检索数据库中的现有词汇锚点',
        'processing_meanings': '⚡ AI正在进行语义去重和含义优化处理',
        'saving_data': '💾 安全保存处理结果到知识图谱数据库',
        'completed': '🎉 恭喜！所有词锚点已成功创建并激活'
      } as const;
      return descriptions[stage as keyof typeof descriptions] || '';
    };
    
      return (
      <motion.div
        className="relative flex flex-col items-center gap-5 py-6 px-4"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* 顶部标题和点点动画 */}
        <motion.div
          className="flex flex-col items-center gap-3"
          layout
        >
          <motion.div 
            className="flex items-center gap-3"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {/* 点点动画 - 替换旋转图标 */}
            {processingProgress.stage !== 'completed' && (
              <motion.div
                className="flex gap-1"
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    animate={{ scale: [0.8, 1.2, 0.8] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                  />
                ))}
              </motion.div>
            )}
            
            {/* 完成时显示勾号 */}
            {processingProgress.stage === 'completed' && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <CheckCircle className="w-6 h-6 text-green-500" />
              </motion.div>
            )}
            
            <motion.div 
              className="text-base font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent text-center"
              key={processingProgress.message}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {processingProgress.message}
            </motion.div>
          </motion.div>
          
          {/* 当前阶段描述 */}
          <motion.div
            className="text-xs text-center max-w-sm leading-relaxed text-muted-foreground"
            key={processingProgress.stage}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {getStageDescription(processingProgress.stage)}
          </motion.div>
        </motion.div>
        
        {/* 现代化进度条容器 */}
        <motion.div 
          className="relative w-full max-w-sm"
          layout
        >
          {/* 进度条背景 */}
          <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            {/* 彩虹进度条 */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            
            {/* 进度条光泽效果 */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full w-16"
              animate={{ x: ['-64px', `${progress * 3}px`] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
            </div>
          
          {/* 进度百分比 - 修复位置 */}
          <motion.div
            className="absolute -top-6 text-xs font-medium text-gray-600 dark:text-gray-400"
            style={{ left: `calc(${Math.max(0, Math.min(85, progress))}% - 12px)` }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {Math.round(progress)}%
          </motion.div>
        </motion.div>

        {/* 优化的阶段指示器 */}
        <motion.div 
          className="flex items-center justify-center gap-4"
          layout
        >
          {stages.map((stage, index) => {
            const isActive = index === currentStageIndex;
            const isCompleted = index < currentStageIndex;
            const config = STAGE_CONFIG[stage];
            
            return (
              <motion.div
                key={stage}
                className="relative flex flex-col items-center gap-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {/* 优化的阶段圆点 */}
                <motion.div
                  className={cn(
                    "relative w-3 h-3 rounded-full border transition-all duration-500",
                    isCompleted && "bg-green-500 border-green-400 shadow-sm shadow-green-500/30",
                    isActive && `bg-${config.color}-500 border-${config.color}-400 shadow-sm shadow-${config.color}-500/30`,
                    !isActive && !isCompleted && "bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-500"
                  )}
                  animate={isActive ? {
                    scale: [1, 1.2, 1]
                  } : {}}
                  transition={isActive ? {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : {}}
                >
                  {/* 内部光点 */}
                  {(isActive || isCompleted) && (
                    <motion.div
                      className="absolute inset-0.5 rounded-full bg-white/60"
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </motion.div>
                
                {/* 缩小的阶段名称 */}
                <motion.span
                  className={cn(
                    "text-[10px] font-medium transition-all duration-300 text-center leading-tight",
                    isActive && `text-${config.color}-600 dark:text-${config.color}-400`,
                    isCompleted && "text-green-600 dark:text-green-400",
                    !isActive && !isCompleted && "text-gray-500 dark:text-gray-400"
                  )}
                  animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                  transition={isActive ? { duration: 2, repeat: Infinity } : {}}
                >
                  {config.name}
                </motion.span>
                
                {/* 连接线 */}
                {index < stages.length - 1 && (
                  <motion.div
                    className="absolute top-1.5 -right-5 w-4 h-px bg-gray-300 dark:bg-gray-600"
                    initial={{ scaleX: 0 }}
                    animate={{ 
                      scaleX: isCompleted ? 1 : 0,
                      backgroundColor: isCompleted ? '#10b981' : '#d1d5db'
                    }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    style={{ originX: 0 }}
                  />
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* 完成时的庆祝动画 */}
        {processingProgress.stage === 'completed' && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                style={{
                  left: '50%',
                  top: '50%',
                }}
                animate={{
                  x: [0, (Math.cos(i * 45 * Math.PI / 180) * 60)],
                  y: [0, (Math.sin(i * 45 * Math.PI / 180) * 60)],
                  opacity: [1, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 1.5,
                  ease: "easeOut"
                }}
              />
            ))}
          </motion.div>
        )}
      </motion.div>
    );
  };

  // 渲染词汇处理状态 - 超现代美化版本
  const renderWordProcessingState = (word: SelectedWord) => {
    if (word.isExisting) return null;

    const state = wordProcessingStates.get(word.id);
    if (!state) return null;
    
    // 如果处理完成且在空闲状态，显示最终结果（简洁版）
    if (processingProgress.stage === 'idle' && state.result) {
      const resultConfig = {
        new: { icon: Sparkles, color: 'emerald', label: 'NEW', bgGradient: 'from-emerald-400 to-green-500' },
        different_meaning: { icon: Brain, color: 'orange', label: '不同含义', bgGradient: 'from-orange-400 to-amber-500' },
        merged: { icon: Star, color: 'blue', label: '合并含义', bgGradient: 'from-blue-400 to-indigo-500' },
        example_added: { icon: FileText, color: 'purple', label: '新例句', bgGradient: 'from-purple-400 to-violet-500' }
      };
      
      const config = resultConfig[state.result];
      return (
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r ${config.bgGradient} text-white text-xs font-medium shadow-sm`}>
          <config.icon className="w-3 h-3" />
          <span>{config.label}</span>
        </div>
      );
    }

    // 含义处理完成后显示最终结果（带炫酷动画）
    if (state.result) {
      const resultConfig = {
        new: { 
          icon: Sparkles, 
          color: 'emerald', 
          label: 'NEW', 
          bgGradient: 'from-emerald-400 to-green-500',
          shadowColor: 'shadow-emerald-500/30'
        },
        different_meaning: { 
          icon: Brain, 
          color: 'orange', 
          label: '不同含义', 
          bgGradient: 'from-orange-400 to-amber-500',
          shadowColor: 'shadow-orange-500/30'
        },
        merged: { 
          icon: Star, 
          color: 'blue', 
          label: '合并含义', 
          bgGradient: 'from-blue-400 to-indigo-500',
          shadowColor: 'shadow-blue-500/30'
        },
        example_added: { 
          icon: FileText, 
          color: 'purple', 
          label: '新例句', 
          bgGradient: 'from-purple-400 to-violet-500',
          shadowColor: 'shadow-purple-500/30'
        }
      };
      
      const config = resultConfig[state.result];
    return (
        <motion.div 
          className={`relative inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r ${config.bgGradient} text-white text-xs font-medium shadow-lg ${config.shadowColor}`}
          initial={{ scale: 0, rotate: -180, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ 
            type: "spring", 
            stiffness: 500, 
            damping: 25,
            duration: 0.6 
          }}
        >
          {/* 背景光效 */}
          <motion.div
            className="absolute inset-0 rounded-full bg-white/20"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <config.icon className="w-3 h-3 relative z-10" />
          </motion.div>
          <span className="relative z-10">{config.label}</span>
          
          {/* 粒子效果 */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white/60 rounded-full"
              style={{
                left: `${20 + i * 20}%`,
                top: '50%',
              }}
              animate={{
                y: [-5, -15, -5],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut"
              }}
            />
          ))}
        </motion.div>
      );
    }

    // 锚点查询完成后显示NEW/OLD状态（超炫酷动画）
    if (state.isNewAnchor) {
      return (
        <motion.div 
          className="relative inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 text-white text-xs font-bold shadow-lg shadow-green-500/40"
          initial={{ scale: 0, y: -20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 600, 
            damping: 20 
          }}
        >
          {/* 动态背景 */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-green-300 to-emerald-400"
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          
          {/* 脉冲环 */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-white/50"
            animate={{ 
              scale: [1, 1.4, 1],
              opacity: [1, 0, 1]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          <motion.div
            className="relative z-10"
            animate={{ 
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 1, repeat: Infinity }}
          >
                <Sparkles className="w-3 h-3" />
          </motion.div>
          <motion.span 
            className="relative z-10"
            animate={{ 
              textShadow: [
                "0 0 0px rgba(255,255,255,0.5)",
                "0 0 10px rgba(255,255,255,0.8)",
                "0 0 0px rgba(255,255,255,0.5)"
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            NEW
          </motion.span>
          
          {/* 星星粒子 */}
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-yellow-300 rounded-full"
              style={{
                left: `${10 + i * 25}%`,
                top: '10%',
              }}
              animate={{
                y: [0, -10, 0],
                rotate: [0, 180, 360],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      );
    }
    
    if (state.isOldAnchor) {
      return (
        <motion.div 
          className="relative inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 text-white text-xs font-bold shadow-lg shadow-amber-500/40"
          initial={{ scale: 0, rotate: 180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 15 
          }}
        >
          {/* 时钟转动背景 */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-300 to-yellow-400"
            animate={{ 
              rotate: [0, 360],
              scale: [0.9, 1.1, 0.9]
            }}
            transition={{ 
              rotate: { duration: 8, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity }
            }}
          />
          
          {/* 外圈光晕 */}
          <motion.div
            className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 opacity-30"
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          <motion.div
            className="relative z-10"
            animate={{ 
              rotate: [0, 360] 
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          >
            <Clock className="w-3 h-3" />
          </motion.div>
          <span className="relative z-10">OLD</span>
          
          {/* 时间粒子 */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-0.5 h-0.5 bg-white rounded-full"
              style={{
                left: `${30 + i * 15}%`,
                top: `${20 + i * 20}%`,
              }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.5,
              }}
            />
          ))}
        </motion.div>
      );
    }
    
    return null;
  };

  // 渲染标签式词汇列表
  const renderTagView = () => (
    <div className="space-y-3">
      {/* 已存在的锚点区域 */}
      {stats.existingTotal > 0 && (
        <div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
            <span>已有锚点 ({stats.existingTotal})</span>
            <span className="text-xs">🔒</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedWords
              .filter(w => w.isExisting)
              .sort((a, b) => a.startIndex - b.startIndex)
              .map((word) => {
                const explanation = wordExplanations.get(word.id);
                const meaningBlock = word.meaningBlock;
                return (
                  <motion.div
                    key={word.id}
                    className="group relative"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
                  >
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100/70 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-md text-sm">
                      <span>{word.text}</span>
                      <div className="w-3 h-3 text-amber-600 dark:text-amber-400" title="已存在的锚点，不可删除">
                        🔒
                      </div>
                    </div>
                    
                    {/* 显示音标和释义信息 */}
                    {meaningBlock && (
                      <motion.div
                        className="mt-1 px-2 py-1 bg-amber-50/50 dark:bg-amber-950/30 rounded text-xs text-amber-600 dark:text-amber-400 space-y-1"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ delay: 0.1 }}
                      >
                        {/* 音标 */}
                        {meaningBlock.phonetic && (
                          <div className="flex items-center gap-1">
                            <span className="text-amber-500 dark:text-amber-400">/{meaningBlock.phonetic}/</span>
                            {meaningBlock.tags && meaningBlock.tags.length > 0 && (
                              <span className="text-amber-400 dark:text-amber-500">
                                ({meaningBlock.tags.join(', ')})
                              </span>
                            )}
                          </div>
                        )}
                        {/* 中文释义 */}
                        {meaningBlock.chinese_meaning && (
                          <div className="text-amber-600 dark:text-amber-400">
                            {meaningBlock.chinese_meaning}
                          </div>
                        )}
                      </motion.div>
                    )}
                    
                    {/* 解释文本（如果有的话） */}
                    {explanation && (
                      <motion.div
                        className="mt-1 px-2 py-1 bg-amber-50/50 dark:bg-amber-950/30 rounded text-xs text-amber-600 dark:text-amber-400"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ delay: 0.1 }}
                      >
                        {explanation.meaning}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

      {/* 单词区域 */}
      {stats.wordCount > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">新选择单词 ({stats.wordCount})</div>
          <div className="flex flex-wrap gap-2">
            {selectedWords
              .filter(w => w.type === 'word' && !w.isExisting)
              .sort((a, b) => a.startIndex - b.startIndex)
              .map((word) => {
                const explanation = wordExplanations.get(word.id);
                return (
          <motion.div
            key={word.id}
                    className="group relative"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
                  >
                    {/* 主词锚点容器 - 包含状态标签 */}
                    <div className="inline-flex items-center justify-between gap-1 px-2 py-1 bg-blue-100/70 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md text-sm transition-all hover:bg-blue-200/80">
                      <div className="flex items-center gap-1">
                      <span>{word.text}</span>
                      <button
                        onClick={() => removeWord(word.id)}
                        className="opacity-0 group-hover:opacity-100 w-3 h-3 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-all"
          >
                        <X className="w-2 h-2" />
                      </button>
                        
                        {/* 加载状态 - 直接放在词内 */}
                        {processingProgress.stage === 'explaining' && !explanation && (
                          <motion.div 
                            className="flex items-center gap-1 text-blue-600 dark:text-blue-400"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-xs">解释中</span>
                          </motion.div>
                        )}
                      </div>
                      
                      {/* 状态标签 - 右侧内联显示 */}
                      {renderWordProcessingState(word)}
                    </div>
                    
                    {/* 解释文本 */}
                    {explanation && (
                      <motion.div
                        className="mt-1 px-2 py-1 bg-blue-50/50 dark:bg-blue-950/30 rounded text-xs text-blue-600 dark:text-blue-400"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ delay: 0.1 }}
            >
                        {explanation.meaning}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

      {/* 短语区域 */}
      {stats.phraseCount > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">新选择短语 ({stats.phraseCount})</div>
          <div className="flex flex-wrap gap-2">
            {selectedWords
              .filter(w => w.type === 'phrase' && !w.isExisting)
              .sort((a, b) => a.startIndex - b.startIndex)
              .map((word) => {
                const explanation = wordExplanations.get(word.id);
                return (
                  <motion.div
                    key={word.id}
                    className="group relative"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
        >
                    {/* 主词锚点容器 - 包含状态标签 */}
                    <div className="inline-flex items-center justify-between gap-1 px-2 py-1 bg-purple-100/70 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-md text-sm transition-all hover:bg-purple-200/80">
                      <div className="flex items-center gap-1">
                      <span>{word.text}</span>
                      <button
                        onClick={() => removeWord(word.id)}
                          className="opacity-0 group-hover:opacity-100 w-3 h-3 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                      >
                        <X className="w-2 h-2" />
                      </button>
                        
                        {/* 加载状态 - 直接放在词内 */}
                        {processingProgress.stage === 'explaining' && !explanation && (
                          <motion.div
                            className="flex items-center gap-1 text-purple-600 dark:text-purple-400"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-xs">解释中</span>
                          </motion.div>
                        )}
                      </div>
                      
                      {/* 状态标签 - 右侧内联显示 */}
                      {renderWordProcessingState(word)}
                    </div>
                    
                    {/* 解释文本 */}
                    {explanation && (
                      <motion.div
                        className="mt-1 px-2 py-1 bg-purple-50/50 dark:bg-purple-950/30 rounded text-xs text-purple-600 dark:text-purple-400"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ delay: 0.1 }}
                      >
                        {explanation.meaning}
                      </motion.div>
                    )}
            </motion.div>
                );
              })}
          </div>
        </div>
      )}
      
      {/* 空状态 */}
      {selectedWords.length === 0 && (
        <div className="text-center py-8 text-muted-foreground/60">
          <div className="text-sm">还没有选择任何词汇</div>
          <div className="text-xs mt-1">在左侧文本中选择单词或短语</div>
      </div>
      )}
    </div>
  );

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩层 - 只在非锚定模式下显示 */}
          {!isAnchorMode && (
            <motion.div
              className="fixed inset-0 bg-black/20 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
          )}
          
          {/* 侧边栏 */}
          <motion.div
            className="fixed right-0 top-0 h-full w-80 bg-card/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          >
            {/* 白色粒子背景 - 仅限于侧边栏 */}
            <ParticleBackground />
            
            {/* 渐变背景 */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-purple-50/15 to-pink-50/20 dark:from-blue-950/15 dark:via-purple-950/10 dark:to-pink-950/15"
              animate={{
                background: [
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(147, 51, 234, 0.06), rgba(236, 72, 153, 0.08))",
                  "linear-gradient(135deg, rgba(147, 51, 234, 0.08), rgba(236, 72, 153, 0.06), rgba(59, 130, 246, 0.08))",
                  "linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(59, 130, 246, 0.06), rgba(147, 51, 234, 0.08))"
                ]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />

              {/* 头部 */}
            <motion.div 
              className="relative z-10 p-4 border-b border-white/10 bg-gradient-to-r from-blue-50/30 to-purple-50/30 dark:from-blue-950/20 dark:to-purple-950/20 backdrop-blur-sm"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-3">
                <motion.div 
                  className="flex items-center gap-3"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.div 
                    className="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg"
                    animate={{ rotate: [0, 180, 360] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-3 h-3 text-white" />
                  </motion.div>
                  <h3 className="font-bold text-base bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    智能词锚点建立
                  </h3>
                </motion.div>
                <motion.button
                    onClick={onClose}
                  className="p-2 hover:bg-white/10 dark:hover:bg-white/5 rounded-lg transition-colors group"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  >
                  <X className="w-4 h-4 group-hover:text-red-400 transition-colors" />
                </motion.button>
              </div>
              
              {/* 统计和控制 */}
              <motion.div 
                className="flex items-center justify-between"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center gap-3 text-xs">
                  <motion.span 
                    className="px-3 py-1 bg-blue-100/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full font-medium shadow-sm"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    新选择 {stats.total}
                  </motion.span>
                  {stats.existingTotal > 0 && (
                    <motion.span 
                      className="px-3 py-1 bg-amber-100/60 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full font-medium shadow-sm"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    >
                      已有 {stats.existingTotal}
                    </motion.span>
                  )}
                    {currentBlocks && currentBlocks.length > 0 && (
                    <motion.span 
                      className="px-3 py-1 bg-purple-100/60 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full font-medium shadow-sm"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                    >
                      语境块 {currentBlocks.length}
                    </motion.span>
                    )}
                </div>
                
                {/* 清空按钮 */}
                {stats.total > 0 && (
                  <motion.button
                    onClick={clearAllWords}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors group"
                    title="清空新选择的词汇"
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash2 className="w-4 h-4 group-hover:animate-bounce" />
                  </motion.button>
                )}
              </motion.div>
            </motion.div>
            
              {/* 主体内容 */}
            <div className="relative z-10 flex-1 p-4 overflow-y-auto space-y-4">
                {/* 词汇标签区域 */}
                <AnimatePresence mode="popLayout">
                  {renderTagView()}
                </AnimatePresence>
                
                {/* 处理阶段状态显示 */}
              {processingProgress.stage !== 'idle' && (
                  <motion.div
                    className="flex items-center justify-center py-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                  {renderProgressIndicator()}
                  </motion.div>
                )}
            </div>
            
              {/* 底部操作区域 */}
            <div className="relative z-10 p-4 border-t border-white/10 space-y-3 bg-gradient-to-r from-blue-50/20 to-purple-50/20 dark:from-blue-950/10 dark:to-purple-950/10 backdrop-blur-sm">
              {/* 查看详情按钮 */}
                {hasExplanations && (
                  <div className="flex justify-end">
                  <motion.button
                      onClick={handleViewDetails}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors group"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    >
                    <Eye className="w-3 h-3 group-hover:animate-pulse" />
                      查看详情
                  </motion.button>
                  </div>
                )}
                
              {/* 收集按钮 */}
              {stats.total > 0 && (
                  <motion.button
                    onClick={handleCollectWords}
                  disabled={processingProgress.stage !== 'idle'}
                  className={cn(
                    "relative w-full py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden",
                    processingProgress.stage !== 'idle'
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-xl hover:shadow-2xl"
                  )}
                  whileHover={processingProgress.stage === 'idle' ? { 
                    scale: 1.02,
                    y: -2
                  } : {}}
                  whileTap={processingProgress.stage === 'idle' ? { 
                    scale: 0.98
                  } : {}}
                  transition={{ 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 25 
                  }}
                >
                  {/* 按钮流光效果 */}
                  {processingProgress.stage === 'idle' && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity, 
                        repeatDelay: 2 
                      }}
                    />
                  )}

                  {/* 按钮内容 */}
                  <div className="relative z-10 flex items-center gap-2">
                    {processingProgress.stage !== 'idle' ? (
                    <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          {getStageIcon(processingProgress.stage)}
                        </motion.div>
                        <span>{STAGE_CONFIG[processingProgress.stage].name}中...</span>
                      </>
                    ) : hasExplanations ? (
                      <>
                        <motion.div
                          animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 180, 360]
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <CheckCircle className="w-5 h-5" />
                        </motion.div>
                        <span>重新收集新锚点</span>
                    </>
                  ) : (
                    <>
                        <motion.div
                          animate={{ 
                            x: [0, 3, 0],
                            rotate: [0, 10, 0]
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        >
                          <Send className="w-5 h-5" />
                        </motion.div>
                        <span>收集新锚点</span>
                        
                        {/* 词汇数量徽章 */}
                        <motion.div
                          className="ml-2 px-2 py-1 bg-white/20 rounded-full text-xs font-medium"
                          animate={{ 
                            scale: [1, 1.1, 1],
                            opacity: [0.8, 1, 0.8]
                          }}
                          transition={{ 
                            duration: 1.5, 
                            repeat: Infinity 
                          }}
                        >
                          {stats.total}
                        </motion.div>
                      </>
                    )}
                  </div>

                  {/* 处理中的粒子效果 */}
                  {processingProgress.stage !== 'idle' && (
                    <div className="absolute inset-0 pointer-events-none">
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-1 h-1 bg-white/40 rounded-full"
                          style={{
                            left: `${10 + i * 15}%`,
                            top: `${20 + (i % 2) * 60}%`,
                          }}
                          animate={{
                            y: [-5, -20, -5],
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  </motion.button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

      {/* 词汇解释器组件 - 详细版 */}
      <WordExplainer
        selectedWords={selectedWords}
        isOpen={showWordExplainer}
        onClose={() => setShowWordExplainer(false)}
        onExplainComplete={() => {}}
        currentBlocks={currentBlocks}
        existingContent={fullExplanationContent}
        processingLogs={processingLogs}
      />
    </>
  );
} 