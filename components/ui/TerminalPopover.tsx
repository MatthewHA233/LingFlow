'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import { AudioController, AUDIO_EVENTS } from '@/lib/audio-controller';
import { toast } from 'sonner';
import { Fragment } from 'react';

// 重新设计的 formatTime 函数
const formatTime = (ms: number) => {
  if (ms === undefined || isNaN(ms)) return '未知';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  const formattedTime = hours > 0
    ? (
      <>
        <span className="text-blue-400">{String(hours).padStart(2, '0')}</span>:
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}.
        <span className="text-gray-400 text-[8px]">{String(milliseconds).padStart(3, '0')}</span>
      </>
    )
    : (
      <>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}.
        <span className="text-gray-400 text-[8px]">{String(milliseconds).padStart(3, '0')}</span>
      </>
    );

  return formattedTime;
};

// 重新设计的 formatWordTime 函数
const formatWordTime = (timeRange?: string) => {
  if (!timeRange) return '';

  const [startMs, endMs] = timeRange.split('~').map(Number);
  if (isNaN(startMs)) return '';

  const format = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    const formattedTime = hours > 0
      ? (
        <>
          <span className="text-blue-400">{String(hours).padStart(2, '0')}</span>:
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}.
          <span className="text-gray-400 text-[8px]">{String(milliseconds).padStart(3, '0')}</span>
        </>
      )
      : (
        <>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}.
          <span className="text-gray-400 text-[8px]">{String(milliseconds).padStart(3, '0')}</span>
        </>
      );

    return formattedTime;
  };

  return endMs ? <>{format(startMs)} ~ {format(endMs)}</> : format(startMs);
};

// 添加自定义终端风格悬浮窗组件
export function TerminalPopover({
  blockId,
  contextBlocks,
  position,
  onClose,
  audioUrl
}: {
  blockId: string,
  contextBlocks: any[],
  position: { x: number, y: number },
  onClose: () => void,
  audioUrl?: string
}) {
  const [alignmentData, setAlignmentData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 数据加载逻辑
  useEffect(() => {
    async function loadAlignmentData() {
      try {
        setIsLoading(true);
        console.log('开始加载块的音频对齐数据, blockId:', blockId);

        // 从block_sentences表直接获取对齐数据
        const { data: blockSentencesData, error: blockSentencesError } = await supabase
          .from('block_sentences')
          .select(`
              block_id,
              sentence_id,
              order_index,
              alignment_score,
              segment_begin_offset,
              segment_end_offset,
              alignment_metadata,
              sentences (id, text_content, begin_time, end_time)
            `)
          .eq('block_id', blockId)
          .order('order_index');

        if (blockSentencesError) {
          console.error('获取block_sentences对齐数据失败:', blockSentencesError);
          return;
        }

        console.log('从block_sentences表获取的数据:', blockSentencesData);

        if (!blockSentencesData || blockSentencesData.length === 0) {
          console.log('未找到块相关的句子对齐数据');
          return;
        }

        // 处理获取到的数据
        const processedData = blockSentencesData.map(item => {
          const timeRange = item.alignment_metadata?.alignment_summary?.time_range;
          const [beginTime, endTime] = timeRange ? timeRange.split('~').map(Number) : [undefined, undefined];

          return {
            id: item.sentence_id,
            order_index: item.order_index,
            alignment_score: item.alignment_score,
            segment_begin_offset: item.segment_begin_offset,
            segment_end_offset: item.segment_end_offset,
            alignment_metadata: item.alignment_metadata || {},
            // 句子信息
            text_content: item.sentences?.[0]?.text_content || '',
            begin_time: beginTime, // 使用从 time_range 解析出的时间
            end_time: endTime     // 使用从 time_range 解析出的时间
          };
        });

        console.log('处理后的对齐数据:', processedData);
        setAlignmentData(processedData);
      } catch (err) {
        console.error('加载音频对齐数据失败:', err);
      } finally {
        setIsLoading(false);
      }
    }

    if (blockId) {
      loadAlignmentData();
    }
  }, [blockId]);

  // 监听音频状态变化
  useEffect(() => {
    const handleStateChange = (e: CustomEvent) => {
      const { isPlaying: newIsPlaying } = e.detail;
      setIsPlaying(newIsPlaying);
    };

    window.addEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);

    return () => {
      window.removeEventListener(AUDIO_EVENTS.STATE_CHANGE, handleStateChange as EventListener);
    };
  }, []);

  // 修改后的 playAudio 函数
  const playAudio = (startTime: number, endTime?: number) => {
    if (!audioUrl) return;

    const context = endTime ? 'sentence' : 'word';

    AudioController.play({
      url: audioUrl,
      startTime,
      endTime,
      context,
      loop: false
    }).catch(error => {
      console.error('播放失败:', error);
    });
  };

  // 复制功能
  const copyToClipboard = () => {
    const textContent = alignmentData.map((item, idx) => {
      let result = `[句子 ${idx + 1}] ${item.text_content}\n`;
      result += `时间范围: ${formatTime(item.begin_time)} - ${formatTime(item.end_time)}\n`; // 使用新的时间格式
      result += `片段偏移: ${item.segment_begin_offset} - ${item.segment_end_offset}\n`; // 添加片段偏移

      if (item.alignment_metadata?.alignment_summary) {
        const summary = item.alignment_metadata.alignment_summary;
        result += `原始文本: ${summary.original_text || ''}\n`;
        result += `对齐文本: ${summary.aligned_text || ''}\n`;
      }

      if (item.alignment_metadata?.word_changes?.words) {
        result += "词语对齐:\n";
        item.alignment_metadata.word_changes.words.forEach((word: any, widx: number) => {
          result += `  ${widx.toString().padStart(2, ' ')}: ${formatWordTime(word.time_range)} "${word.original || '(空)'}"${word.original !== word.aligned ? ` → "${word.aligned || '(空)'}"` : ""
            }\n`;
        });
      }

      // 添加对齐方法、版本和日期
      if (item.alignment_metadata?.alignment_method) {
        result += `\n对齐方法: ${item.alignment_metadata.alignment_method}\n`;
        result += `算法版本: ${item.alignment_metadata.algorithm_version || '未知'}\n`;
        if (item.alignment_metadata?.alignment_summary?.alignment_date) {
          result += `对齐日期: ${item.alignment_metadata.alignment_summary.alignment_date}\n`;
        }
      }

      return result + "\n";
    }).join("");

    navigator.clipboard.writeText(textContent);
    toast.success("已复制到剪贴板");
  };

  // 点击外部关闭的逻辑
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  if (isLoading) {
    return (
      <div
        ref={popoverRef}
        className="fixed z-50 bg-[#1e1e1e] text-[#d4d4d4] p-3 rounded shadow-lg w-96 h-48"
        style={{
          top: `${position.y}px`,
          left: `${position.x}px`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400">正在加载对齐数据...</div>
        </div>
      </div>
    );
  }

  if (!alignmentData.length) {
    return (
      <div
        ref={popoverRef}
        className="fixed z-50 bg-[#1e1e1e] text-[#d4d4d4] p-3 rounded shadow-lg w-96 h-48"
        style={{
          top: `${position.y}px`,
          left: `${position.x}px`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400">未找到对齐数据</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-[#1e1e1e] text-[#d4d4d4] p-2 rounded shadow-lg 
                   w-[420px] max-h-[420px] overflow-auto custom-scrollbar border border-gray-700"
      style={{
        top: `${position.y - 140}px`,
        left: `${position.x - 210}px`
      }}
    >
      {/* 标题栏和按钮 */}
      <div className="flex justify-between items-center mb-3 sticky top-0 bg-[#1e1e1e] py-2 border-b border-gray-700 z-10">
        <span className="text-sm font-medium text-gray-300">对齐细节表</span>
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard();
            }}
            className="text-gray-400 hover:text-white p-1 rounded"
            title="复制全部"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-white p-1 rounded ml-2"
            title="关闭"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* 句子对齐详情 */}
      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
        {alignmentData.map((item, idx) => {
          // 从alignment_metadata中获取原始文本和对齐文本
          const originalText = item.alignment_metadata?.alignment_summary?.original_text || item.text_content;
          const alignedText = item.alignment_metadata?.alignment_summary?.aligned_text || item.text_content;

          return (
            <div key={idx} className="pb-2 mb-1 border-b border-gray-700">
              {/* 句子标题和播放按钮 */}
              <div className="flex justify-between items-center mb-1">
                <div className="text-green-300 font-bold flex items-center">
                  <span>[句子 {idx + 1}]</span>
                  {item.alignment_score && (
                    <span className="ml-2 text-[10px] text-yellow-400">
                      匹配度: {(parseFloat(item.alignment_score) * 100).toFixed(1)}%
                    </span>
                  )}
                  {item.alignment_status && (
                    <span className="ml-2 text-[10px] text-blue-400">
                      {item.alignment_status === 'automated' ? '自动' : '人工'}
                    </span>
                  )}
                  {/* 片段偏移 */}
                  {item.segment_begin_offset !== undefined && item.segment_end_offset !== undefined && (
                    <span className="ml-2 text-[10px] text-gray-400">
                      偏移: {item.segment_begin_offset}-{item.segment_end_offset}
                    </span>
                  )}
                  {audioUrl && item.begin_time !== undefined && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playAudio(item.begin_time, item.end_time);
                      }}
                      className="ml-2 text-gray-400 hover:text-white"
                      title="播放句子"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    </button>
                  )}
                </div>
                <span className="text-yellow-300 text-[10px]">
                  {/* 使用新的时间格式化函数 */}
                  {formatTime(item.begin_time)} - {formatTime(item.end_time)}
                </span>
              </div>

              {/* 添加句子文本显示区域 */}
              <div className="mb-2 pl-1">
                {originalText !== alignedText ? (
                  <>
                    <div className="flex">
                      <span className="text-gray-500 w-10 text-[10px]">原文:</span>
                      <span className="text-red-300 text-[10px]">{originalText}</span>
                    </div>
                    <div className="flex">
                      <span className="text-gray-500 w-10 text-[10px]">对齐:</span>
                      <span className="text-green-300 text-[10px]">{alignedText}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-white text-[10px]">{alignedText}</div>
                )}
              </div>

              {/* 词语对齐表 - 终端风格 */}
              {item.alignment_metadata?.word_changes?.words && (
                <div className="mt-1 text-[10px]">
                  <div className="font-mono">
                    <div className="grid grid-cols-[1fr_2fr_1.5fr_1.5fr_0.5fr] text-gray-500 border-b border-gray-700 pb-1">
                      <span>序号</span>
                      <span className="text-cyan-300">时间</span>
                      <span className="text-orange-300 text-right pr-2">原词</span>
                      <span className="text-green-300 text-left pl-2">对齐词</span>
                      <span></span>
                    </div>
                    {item.alignment_metadata.word_changes.words.map((word: any, widx: number) => {
                      const timeRange = word.time_range?.split('~');
                      const startTime = timeRange?.[0] ? parseInt(timeRange[0], 10) : null;
                      const isDifferent = word.original !== word.aligned;

                      return (
                        <div key={widx} className="grid grid-cols-[1fr_2fr_1.5fr_1.5fr_0.5fr] items-center hover:bg-gray-800 border-b border-gray-900" onClick={(e) => e.stopPropagation()}>
                          <span className="text-gray-500">{widx}</span>
                          {/* 使用新的时间格式化函数 */}
                          <span className="text-cyan-300">{formatWordTime(word.time_range)}</span>
                          <span
                            className={`flex items-center justify-end pr-2 ${word.original === null || word.original === undefined
                              ? 'text-gray-500'
                              : isDifferent
                                ? 'text-red-400'
                                : 'text-white'
                              }`}
                            title={word.original}
                          >
                            {word.original !== null && word.original !== undefined ? word.original : '(空)'}
                          </span>
                          <span
                            className={`flex items-center justify-start pl-2 ${word.original === null || word.original === undefined
                              ? 'text-gray-500'
                              : isDifferent
                                ? 'text-green-400'
                                : 'text-white'
                              }`}
                            title={word.aligned}
                          >
                            {word.aligned}
                          </span>
                          <span className="text-right">
                            {audioUrl && startTime && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playAudio(startTime);
                                }}
                                className="text-gray-500 hover:text-white"
                                title="播放单词"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 