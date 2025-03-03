import { supabase } from '@/lib/supabase-client';
import * as stringSimilarity from 'string-similarity';

export interface AlignmentResult {
  blockId: string;
  speechId: string;
  alignedSentences: {
    sentenceId: string;
    originalText: string;
    alignedText: string;
    beginTime: number;
    endTime: number;
    orderIndex: number;
  }[];
  remainingText: string | null;
  success: boolean;
  message?: string;
}

export class TextAlignmentService {
  /**
   * 将语音识别的句子对齐到语境块中
   * 支持多句连续对齐
   */
  static async alignSentenceToBlock(
    blockId: string, 
    sentenceId: string, 
    speechId: string
  ): Promise<AlignmentResult> {
    try {
      console.log('================== 文本对齐开始 ===================');
      console.log('输入参数:', { blockId, sentenceId, speechId });
      
      // 1. 获取语境块文本
      console.log('1. 正在获取语境块数据...');
      const { data: blockData, error: blockError } = await supabase
        .from('context_blocks')
        .select('*')
        .eq('id', blockId)
        .single();
      
      if (blockError) {
        console.error('获取语境块失败:', blockError);
        throw new Error(`获取语境块失败: ${blockError.message}`);
      }
      
      console.log('获取到语境块:', {
        id: blockData.id,
        type: blockData.block_type,
        contentPreview: blockData.content ? blockData.content.substring(0, 100) + '...' : '无内容',
        metadata: blockData.metadata
      });
      
      // 2. 获取句子及后续句子数据（为支持多句对齐）
      console.log('2. 正在获取句子数据...');
      
      // 首先获取目标句子的时间戳作为参考点
      console.log('2.1 获取目标句子时间戳...');
      const { data: targetSentence, error: targetError } = await supabase
        .from('sentences')
        .select('begin_time, text_content')
        .eq('id', sentenceId)
        .single();
      
      if (targetError) {
        console.error('获取目标句子失败:', targetError);
        throw new Error(`获取目标句子失败: ${targetError.message}`);
      }
      
      console.log('目标句子时间戳:', targetSentence.begin_time);
      console.log('目标句子内容:', targetSentence.text_content);
      
      // 然后获取从这个时间戳开始的所有句子
      console.log('2.2 获取后续句子...');
      const { data: sentencesData, error: sentencesError } = await supabase
        .from('sentences')
        .select('*')
        .eq('speech_id', speechId)
        .gte('begin_time', targetSentence.begin_time)
        .order('begin_time');
      
      if (sentencesError) {
        console.error('获取句子集合失败:', sentencesError);
        throw new Error(`获取句子集合失败: ${sentencesError.message}`);
      }
      
      console.log(`获取到 ${sentencesData?.length || 0} 个连续句子`);
      sentencesData?.forEach((s, i) => {
        console.log(`句子 ${i+1}:`, {
          id: s.id,
          beginTime: s.begin_time,
          endTime: s.end_time,
          textPreview: s.text_content.substring(0, 50) + (s.text_content.length > 50 ? '...' : '')
        });
      });
      
      if (!sentencesData || sentencesData.length === 0) {
        console.error('没有找到可对齐的句子');
        throw new Error('没有找到可对齐的句子');
      }
      
      // 初始化结果
      console.log('3. 初始化对齐结果对象');
      const result: AlignmentResult = {
        blockId,
        speechId,
        alignedSentences: [],
        remainingText: null,
        success: true
      };
      
      // 3. 从当前块开始，对每个句子执行对齐
      console.log('4. 开始逐句对齐');
      let currentText = blockData.content;
      console.log('当前块文本:', currentText);
      
      let offset = 0;
      let orderIndex = 0;
      
      for (const sentence of sentencesData) {
        console.log(`\n处理第 ${orderIndex+1} 个句子:`, {
          id: sentence.id,
          text: sentence.text_content
        });
        
        if (!currentText || currentText.trim().length === 0) {
          console.log('当前块文本已用完，停止对齐');
          result.remainingText = null;
          break;
        }
        
        console.log('4.1 计算最佳匹配...');
        // 调用文本匹配方法查找最佳匹配位置
        const matchResult = this.findBestTextMatch(
          sentence.text_content,
          currentText
        );
        
        console.log('匹配结果:', {
          score: matchResult.score,
          startIndex: matchResult.startIndex,
          matchedText: matchResult.matchedText ? 
                      (matchResult.matchedText.length > 50 ? 
                       matchResult.matchedText.substring(0, 50) + '...' : 
                       matchResult.matchedText) : '无匹配'
        });
        
        // 如果匹配度过低，停止当前对齐
        if (matchResult.score < 0.6) {
          console.log('匹配度过低(低于0.6)，停止对齐');
          result.remainingText = currentText;
          break;
        }
        
        // 提取对齐文本
        const alignedText = matchResult.matchedText;
        
        // 添加到结果中
        console.log('4.2 添加对齐结果:');
        console.log('原始文本:', sentence.text_content);
        console.log('对齐文本:', alignedText);
        console.log('开始时间:', sentence.begin_time);
        console.log('结束时间:', sentence.end_time);
        
        result.alignedSentences.push({
          sentenceId: sentence.id,
          originalText: sentence.text_content,
          alignedText: alignedText,
          beginTime: sentence.begin_time,
          endTime: sentence.end_time,
          orderIndex: orderIndex++
        });
        
        // 更新剩余文本，去除已对齐部分
        const newStartIndex = matchResult.startIndex + alignedText.length;
        console.log(`4.3 更新剩余文本，从位置 ${newStartIndex} 开始截取`);
        currentText = currentText.substring(newStartIndex);
        console.log('剩余文本(前100字符):', currentText.substring(0, 100) + (currentText.length > 100 ? '...' : ''));
      }
      
      console.log('\n5. 对齐过程完成');
      console.log(`成功对齐 ${result.alignedSentences.length} 个句子`);
      console.log('剩余未对齐文本长度:', result.remainingText ? result.remainingText.length : 0);
      
      // 4. 如果确认对齐有效，模拟保存操作（但实际不执行）
      if (result.alignedSentences.length > 0) {
        console.log('\n6. 【预期数据库更新操作】:');
        
        // 模拟更新语境块
        console.log('6.1 更新语境块:', {
          blockId: blockId,
          更新内容: {
            block_type: 'audio_aligned',
            speech_id: speechId,
            begin_time: result.alignedSentences[0].beginTime,
            end_time: result.alignedSentences[result.alignedSentences.length - 1].endTime
          }
        });
        
        // 模拟更新每个句子
        console.log('6.2 更新句子:');
        for (const sentence of result.alignedSentences) {
          console.log(`  句子ID ${sentence.sentenceId}:`, {
            original_text_content: sentence.originalText,
            text_content: sentence.alignedText,
            conversion_status: 'converted'
          });
        }
        
        // 模拟创建关联记录
        console.log('6.3 创建句子-块关联:');
        for (const sentence of result.alignedSentences) {
          console.log(`  关联记录:`, {
            block_id: blockId,
            sentence_id: sentence.sentenceId,
            order_index: sentence.orderIndex
          });
        }
        
        // 确认是否真正执行更新
        const shouldExecuteUpdates = false; // 这里可以根据需要设置为false
        if (shouldExecuteUpdates) {
          console.log('\n7. 执行实际数据库更新');
          await this.saveAlignmentResults(blockId, speechId, blockData.content, result);
          
          // 5. 处理单词级对齐（如果需要）
          console.log('\n8. 处理单词级对齐');
          for (const sentence of result.alignedSentences) {
            console.log(`处理句子 ${sentence.sentenceId} 的单词对齐`);
            await this.alignWordsForSentence(sentence.sentenceId, sentence.alignedText);
          }
        } else {
          console.log('\n7. 跳过实际数据库更新（仅记录日志）');
        }

        // 在任何情况下，都输出对齐摘要到终端
        console.log('\n========================= 对齐摘要 =========================');
        await this.logAlignmentSummaryToTerminal(blockId, speechId, blockData.content, result);
        console.log('=============================================================');
      } else {
        console.log('\n没有对齐成功的句子，跳过数据库更新');
      }
      
      console.log('================== 文本对齐结束 ===================');
      return result;
    } catch (error) {
      console.error('文本对齐失败:', error);
      return {
        blockId,
        speechId,
        alignedSentences: [],
        remainingText: null,
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      };
    }
  }
  
  /**
   * 寻找句子文本在目标文本中的最佳匹配位置
   * 改进版：更好地处理标点符号，特别是成对的引号等
   */
  private static findBestTextMatch(sentenceText: string, targetText: string): {
    startIndex: number;
    matchedText: string;
    score: number;
  } {
    console.log('【文本匹配计算】:');
    console.log(`- 句子文本: ${sentenceText}`);
    console.log(`- 块文本长度: ${targetText.length}`);
    
    // 处理目标文本为空的情况
    if (!targetText || targetText.length === 0) {
      console.log('- 目标文本为空，无法匹配');
      return { startIndex: 0, matchedText: '', score: 0 };
    }
    
    // 预处理文本 - 规范化空白字符和标点符号
    console.log('- 预处理文本...');
    const normalizedSentence = this.normalizeText(sentenceText);
    const normalizedTarget = this.normalizeText(targetText);
    
    console.log(`- 规范化后句子长度: ${normalizedSentence.length}`);
    console.log(`- 规范化后块文本长度: ${normalizedTarget.length}`);
    
    // 检查长度情况
    if (normalizedSentence.length > normalizedTarget.length) {
      console.log('- 句子长度超过块文本长度，返回低匹配度');
      return { startIndex: 0, matchedText: '', score: 0.3 };
    }
    
    let bestScore = 0;
    let bestStartIndex = 0;
    let bestEndIndex = 0;
    
    // 滑动窗口方法查找最佳匹配
    console.log('- 尝试不同窗口大小进行匹配');
    const windowSizes = [
      normalizedSentence.length,
      normalizedSentence.length + 5,
      normalizedSentence.length + 10,
      Math.round(normalizedSentence.length * 1.2)
    ];
    
    console.log(`- 窗口大小: ${windowSizes.join(', ')}`);
    
    // 存储匹配详情的数组，用于调试
    const matchDetails: Array<{
      windowSize: number;
      bestScoreForWindow: number;
      bestStartForWindow: number;
      bestEndForWindow: number;
      candidateText: string;
    }> = [];
    
    // 对每个窗口大小尝试匹配
    for (const windowSize of windowSizes) {
      let localBestScore = 0;
      let localBestStart = 0;
      let localBestEnd = 0;
      
      // 滑动窗口
      for (let i = 0; i <= normalizedTarget.length - windowSize; i++) {
        const candidateText = normalizedTarget.substring(i, i + windowSize);
        const score = stringSimilarity.compareTwoStrings(
          normalizedSentence, 
          candidateText
        );
        
        if (score > localBestScore) {
          localBestScore = score;
          localBestStart = i;
          localBestEnd = i + windowSize;
        }
      }
      
      // 记录当前窗口大小的最佳匹配
      if (localBestScore > 0) {
        matchDetails.push({
          windowSize,
          bestScoreForWindow: localBestScore,
          bestStartForWindow: localBestStart,
          bestEndForWindow: localBestEnd,
          candidateText: normalizedTarget.substring(localBestStart, localBestEnd)
        });
      }
      
      // 更新全局最佳匹配
      if (localBestScore > bestScore) {
        bestScore = localBestScore;
        bestStartIndex = localBestStart;
        bestEndIndex = localBestEnd;
      }
    }
    
    // 输出匹配详情以便调试
    if (matchDetails.length > 0) {
      console.log('- 各窗口最佳匹配:');
      matchDetails.forEach(detail => {
        console.log(`  窗口大小 ${detail.windowSize}: 分数 ${detail.bestScoreForWindow.toFixed(2)}, 匹配文本: "${detail.candidateText.substring(0, 50)}${detail.candidateText.length > 50 ? '...' : ''}"`);
      });
    }
    
    console.log(`- 最终最佳匹配: 分数 ${bestScore.toFixed(2)}, 位置 ${bestStartIndex}~${bestEndIndex}`);
    
    // 优化匹配边界处理成对标点符号
    const matchedText = this.optimizeMatchBoundaries(
      targetText, 
      bestStartIndex, 
      bestEndIndex
    );
    
    return {
      startIndex: bestStartIndex,
      matchedText: matchedText,
      score: bestScore
    };
  }
  
  /**
   * 规范化文本用于对比
   */
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * 优化匹配边界，特别处理引号等成对标点
   */
  private static optimizeMatchBoundaries(
    originalText: string, 
    startIndex: number, 
    endIndex: number
  ): string {
    // 如果边界无效，直接返回空字符串
    if (startIndex >= endIndex || startIndex < 0 || endIndex > originalText.length) {
      return '';
    }
    
    let optimizedStart = startIndex;
    let optimizedEnd = endIndex;
    
    // 初始文本
    let matchedText = originalText.substring(optimizedStart, optimizedEnd);
    console.log(`- 初始匹配文本: "${matchedText}"`);
    
    // 处理左侧边界 - 向左扩展查找引号或其他需要包含的标点
    const leftExtensionChars = ['"', '"', '(', '[', '{', '\u2019', '\u00AB'];
    const leftContextStart = Math.max(0, optimizedStart - 10);
    const leftContext = originalText.substring(leftContextStart, optimizedStart);
    
    // 查找最近的左侧特殊字符
    for (const char of leftExtensionChars) {
      const lastIndex = leftContext.lastIndexOf(char);
      if (lastIndex !== -1) {
        const newStart = leftContextStart + lastIndex;
        // 只有当这是一个成对标点的左边界时才扩展
        if (this.isOpeningPunctuation(char)) {
          console.log(`- 向左扩展边界，包含 ${char} 字符`);
          optimizedStart = newStart;
          break;
        }
      }
    }
    
    // 优先处理：检查原始文本中是否存在完整句子并截断
    const sentenceEndingChars = ['.', '!', '?'];
    
    // 先在匹配的文本中查找所有句子结束符位置
    const sentenceEndings: {position: number, char: string}[] = [];
    
    for (const char of sentenceEndingChars) {
      let pos = matchedText.indexOf(char);
      while (pos !== -1) {
        // 检查是否是真正的句子结束（后面是空格、引号或文本结束）
        const isRealSentenceEnding = 
          pos === matchedText.length - 1 || // 文本末尾
          pos + 1 < matchedText.length && (
            matchedText[pos + 1] === ' ' || // 后跟空格
            matchedText[pos + 1] === '"' || // 后跟引号
            matchedText[pos + 1] === '\n'   // 后跟换行
          );
        
        if (isRealSentenceEnding) {
          sentenceEndings.push({ position: pos, char });
        }
        pos = matchedText.indexOf(char, pos + 1);
      }
    }
    
    // 按位置排序
    sentenceEndings.sort((a, b) => a.position - b.position);
    
    // 如果找到句子结束符，截断到第一个完整句子
    if (sentenceEndings.length > 0) {
      const firstSentenceEnd = sentenceEndings[0];
      // 移到句子结束符之后（包含标点符号）
      console.log(`- 找到句子结束符 ${firstSentenceEnd.char} 在位置 ${firstSentenceEnd.position}`);
      
      // 如果句子结束符不在文本末尾，截断到这个位置
      if (firstSentenceEnd.position < matchedText.length - 1) {
        optimizedEnd = optimizedStart + firstSentenceEnd.position + 1; // +1 包含句子结束符本身
        matchedText = originalText.substring(optimizedStart, optimizedEnd);
        console.log(`- 截断到第一个完整句子: "${matchedText}"`);
        return matchedText; // 直接返回处理后的文本
      }
    }
    
    // 如果没有找到完整句子，尝试其他处理方法...
    // 处理右侧边界 - 向右扩展查找引号等成对标点
    const rightExtensionChars = ['"', '"', ')', ']', '}', '\u2019', '\u00BB'];
    const rightContextEnd = Math.min(originalText.length, optimizedEnd + 15);
    const rightContext = originalText.substring(optimizedEnd, rightContextEnd);
    
    // 先查找成对标点符号
    let foundPunctuation = false;
    for (const char of rightExtensionChars) {
      const firstIndex = rightContext.indexOf(char);
      if (firstIndex !== -1 && firstIndex < 5) { // 只考虑很近的标点
        const newEnd = optimizedEnd + firstIndex + 1; // +1 to include the char itself
        // 对于结束标点，扩展边界
        if (this.isClosingPunctuation(char)) {
          console.log(`- 向右扩展边界，包含闭合标点 ${char} 字符`);
          optimizedEnd = newEnd;
          foundPunctuation = true;
          break;
        }
      }
    }
    
    // 如果没找到成对标点，再查找句子结束符
    if (!foundPunctuation) {
      for (const char of sentenceEndingChars) {
        const firstIndex = rightContext.indexOf(char);
        if (firstIndex !== -1) {
          const newEnd = optimizedEnd + firstIndex + 1; // +1 包含句子结束符本身
          console.log(`- 向右扩展边界，包含句子结束符 ${char}`);
          optimizedEnd = newEnd;
          break;
        }
      }
    }
    
    // 最终文本
    matchedText = originalText.substring(optimizedStart, optimizedEnd);
    console.log(`- 优化后匹配文本: "${matchedText}"`);
    
    return matchedText;
  }
  
  /**
   * 检查是否为开放性标点符号（左引号、左括号等）
   */
  private static isOpeningPunctuation(char: string): boolean {
    return ['"', '(', '[', '{', '\u2019', '\u00AB'].includes(char);
  }
  
  /**
   * 检查是否为闭合性标点符号（右引号、右括号等）
   */
  private static isClosingPunctuation(char: string): boolean {
    return ['"', ')', ']', '}', '\u2019', '\u00BB'].includes(char);
  }
  
  /**
   * 检查是否为句子结束符号
   */
  private static isSentenceEnding(char: string): boolean {
    return ['.', '!', '?'].includes(char);
  }
  
  /**
   * 检查文本中的成对标点符号是否平衡
   */
  private static hasPunctuationImbalance(text: string): boolean {
    const pairs = [
      ['"', '"'],
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
      ['\u2019', '\u2019'],
      ['\u00AB', '\u00BB']
    ];
    
    for (const [opening, closing] of pairs) {
      const openCount = (text.match(new RegExp(this.escapeRegExp(opening), 'g')) || []).length;
      const closeCount = (text.match(new RegExp(this.escapeRegExp(closing), 'g')) || []).length;
      
      if (openCount !== closeCount) {
        console.log(`- 标点不平衡: ${opening}=${openCount}, ${closing}=${closeCount}`);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 转义正则表达式特殊字符
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * 修复文本中不平衡的标点符号
   */
  private static balancePunctuation(
    text: string, 
    originalText: string, 
    startIndex: number, 
    endIndex: number
  ): string {
    // 检查和修复引号
    const quoteImbalance = (text.match(/"/g) || []).length % 2;
    if (quoteImbalance !== 0) {
      // 向右查找缺失的引号
      const rightContext = originalText.substring(endIndex, endIndex + 20);
      const quoteIndex = rightContext.indexOf('"');
      
      if (quoteIndex !== -1) {
        // 扩展文本以包含缺失的引号
        console.log(`- 向右扩展以包含缺失的引号，位置 +${quoteIndex}`);
        return originalText.substring(startIndex, endIndex + quoteIndex + 1);
      }
      
      // 向左查找缺失的引号
      const leftContext = originalText.substring(Math.max(0, startIndex - 20), startIndex);
      const leftQuoteIndex = leftContext.lastIndexOf('"');
      
      if (leftQuoteIndex !== -1) {
        // 扩展文本以包含缺失的引号
        const newStart = Math.max(0, startIndex - 20) + leftQuoteIndex;
        console.log(`- 向左扩展以包含缺失的引号，位置 -${startIndex - newStart}`);
        return originalText.substring(newStart, endIndex);
      }
    }
    
    // 如果无法修复，返回原文本
    return text;
  }
  
  /**
   * 保存文本对齐结果
   */
  private static async saveAlignmentResults(
    blockId: string,
    speechId: string,
    originalText: string,
    result: AlignmentResult
  ) {
    try {
      console.log('【开始保存对齐结果】');
      
      // 1. 更新语境块类型为音频对齐
      console.log('更新语境块:', blockId);
      const updateData = {
        block_type: 'audio_aligned',
        speech_id: speechId
      };
      console.log('更新数据:', updateData);
      
      const { data: blockUpdateData, error: blockUpdateError } = await supabase
        .from('context_blocks')
        .update(updateData)
        .eq('id', blockId);
      
      if (blockUpdateError) {
        console.error('更新语境块失败:', blockUpdateError);
        throw new Error(`更新语境块失败: ${blockUpdateError.message}`);
      }
      
      console.log('语境块更新成功');
      
      // 2. 更新句子的文本内容
      console.log('更新句子数据:');
      for (const sentence of result.alignedSentences) {
        console.log(`处理句子 ${sentence.sentenceId}`);
        
        const sentenceUpdate = {
          original_text_content: sentence.originalText,
          text_content: sentence.alignedText,
          conversion_status: 'converted'
        };
        console.log('句子更新数据:', sentenceUpdate);
        
        const { data: sentenceUpdateData, error: sentenceUpdateError } = await supabase
          .from('sentences')
          .update(sentenceUpdate)
          .eq('id', sentence.sentenceId);
        
        if (sentenceUpdateError) {
          console.error('更新句子失败:', sentenceUpdateError);
          throw new Error(`更新句子失败: ${sentenceUpdateError.message}`);
        }
        
        console.log(`句子 ${sentence.sentenceId} 更新成功`);
        
        // 3. 创建句子和语境块的关联
        console.log(`创建语境块-句子关联: 块=${blockId}, 句子=${sentence.sentenceId}`);
        const linkData = {
          block_id: blockId,
          sentence_id: sentence.sentenceId,
          order_index: sentence.orderIndex
        };
        console.log('关联数据:', linkData);
        
        const { data: linkData2, error: linkError } = await supabase
          .from('block_sentences')
          .insert(linkData);
        
        if (linkError) {
          console.error('创建语境块-句子关联失败:', linkError);
          throw new Error(`创建语境块-句子关联失败: ${linkError.message}`);
        }
        
        console.log(`关联创建成功`);
      }
      
      console.log('对齐结果保存成功');
    } catch (error) {
      console.error('保存对齐结果失败:', error);
      throw error;
    }
  }
  
  /**
   * 为句子执行单词级对齐
   * 直接使用原始文本和对齐文本的单词对比
   */
  private static async alignWordsForSentence(sentenceId: string, alignedText: string) {
    try {
      console.log(`【开始处理句子 ${sentenceId} 的单词对齐】`);
      
      // 1. 获取现有单词数据
      console.log('1. 获取现有单词数据');
      const { data: words, error: wordsError } = await supabase
        .from('words')
        .select('*')
        .eq('sentence_id', sentenceId)
        .order('begin_time');
      
      if (wordsError) {
        console.error('获取单词数据失败:', wordsError);
        throw new Error(`获取单词数据失败: ${wordsError.message}`);
      }
      
      console.log(`获取到 ${words?.length || 0} 个单词`);
      words?.forEach((word, i) => {
        console.log(`单词 ${i+1}: id=${word.id}, 内容="${word.word}", 开始时间=${word.begin_time}, 结束时间=${word.end_time}`);
      });
      
      // 2. 获取句子的原始文本内容
      console.log('2. 获取句子原始文本');
      const { data: sentence, error: sentenceError } = await supabase
        .from('sentences')
        .select('original_text_content')
        .eq('id', sentenceId)
        .single();
      
      if (sentenceError) {
        console.error('获取句子原始文本失败:', sentenceError);
        throw new Error(`获取句子原始文本失败: ${sentenceError.message}`);
      }
      
      const originalText = sentence.original_text_content || '';
      console.log(`原始文本: "${originalText}"`);
      console.log(`对齐文本: "${alignedText}"`);
      
      // 3. 提取原始文本和对齐文本中的单词
      const originalWords = this.extractWords(originalText);
      const alignedWords = this.extractWords(alignedText);
      
      console.log('原始单词列表:', originalWords);
      console.log('对齐单词列表:', alignedWords);
      
      // 4. 处理单词更新
      console.log('4. 处理单词对齐');
      
      // 如果没有现有单词数据，无法执行对齐
      if (!words || words.length === 0) {
        console.log('没有现有单词数据，跳过单词对齐');
        return;
      }
      
      // 只处理单词文本的变化，保留原始时间戳和顺序
      // 比较两列表长度
      if (originalWords.length === alignedWords.length) {
        console.log('情况1: 原始文本和对齐文本单词数量相同，逐一更新单词内容');
        
        // 逐一更新单词内容，保留原始顺序和时间戳
        for (let i = 0; i < Math.min(words.length, alignedWords.length); i++) {
          const currentWord = words[i];
          const newWordText = alignedWords[i];
          
          // 仅当单词文本不同时更新
          if (currentWord.word !== newWordText) {
            console.log(`更新单词 ${i+1}:`, {
              id: currentWord.id,
              oldWord: currentWord.word,
              newWord: newWordText
            });
            
            const wordUpdate = {
              original_word: currentWord.word, // 保存原始单词
              word: newWordText           // 更新为新单词
            };
            
            const { error: updateError } = await supabase
              .from('words')
              .update(wordUpdate)
              .eq('id', currentWord.id);
              
            if (updateError) {
              console.error(`更新单词 ${currentWord.id} 失败:`, updateError);
            } else {
              console.log(`单词 ${currentWord.id} 更新成功`);
            }
          } else {
            console.log(`单词 ${i+1}: "${currentWord.word}" 无需更新`);
          }
        }
      } 
      else if (alignedWords.length > originalWords.length) {
        console.log('情况2: 对齐文本单词数量增加，更新现有单词并添加新单词');
        
        // 首先更新现有单词
        for (let i = 0; i < Math.min(words.length, originalWords.length); i++) {
          const currentWord = words[i];
          const newWordText = i < alignedWords.length ? alignedWords[i] : '';
          
          if (currentWord.word !== newWordText) {
            console.log(`更新单词 ${i+1}:`, {
              id: currentWord.id,
              oldWord: currentWord.word,
              newWord: newWordText
            });
            
            const wordUpdate = {
              original_word: currentWord.word,
              word: newWordText
            };
            
            const { error: updateError } = await supabase
              .from('words')
              .update(wordUpdate)
              .eq('id', currentWord.id);
              
            if (updateError) {
              console.error(`更新单词 ${currentWord.id} 失败:`, updateError);
            } else {
              console.log(`单词 ${currentWord.id} 更新成功`);
            }
          }
        }
        
        // 然后添加新增的单词
        if (alignedWords.length > words.length) {
          console.log(`需要添加 ${alignedWords.length - words.length} 个新单词`);
          
          // 计算新单词的时间戳
          // 简单方法：平均分配最后一个单词之后的时间
          const lastWord = words[words.length - 1];
          const timePerWord = 200; // 每个单词平均时长（毫秒）
          
          for (let i = words.length; i < alignedWords.length; i++) {
            const newWord = {
              sentence_id: sentenceId,
              word: alignedWords[i],
              original_word: '',
              begin_time: lastWord.end_time + (i - words.length) * timePerWord,
              end_time: lastWord.end_time + (i - words.length + 1) * timePerWord
            };
            
            console.log(`添加新单词 ${i+1}:`, newWord);
            
            const { error: insertError } = await supabase
              .from('words')
              .insert(newWord);
            
            if (insertError) {
              console.error(`添加单词 "${alignedWords[i]}" 失败:`, insertError);
            } else {
              console.log(`单词 "${alignedWords[i]}" 添加成功`);
            }
          }
        }
      }
      else {
        console.log('情况3: 对齐文本单词数量减少，更新保留的单词并删除多余单词');
        
        // 更新保留的单词
        for (let i = 0; i < alignedWords.length; i++) {
          const currentWord = words[i];
          const newWordText = alignedWords[i];
          
          if (currentWord.word !== newWordText) {
            console.log(`更新保留的单词 ${i+1}:`, {
              id: currentWord.id,
              oldWord: currentWord.word,
              newWord: newWordText
            });
            
            const wordUpdate = {
              original_word: currentWord.word,
              word: newWordText
            };
            
            const { error: updateError } = await supabase
              .from('words')
              .update(wordUpdate)
              .eq('id', currentWord.id);
              
            if (updateError) {
              console.error(`更新单词 ${currentWord.id} 失败:`, updateError);
            } else {
              console.log(`单词 ${currentWord.id} 更新成功`);
            }
          }
        }
        
        // 删除多余的单词
        if (words.length > alignedWords.length) {
          const wordIdsToDelete = words.slice(alignedWords.length).map(w => w.id);
          
          if (wordIdsToDelete.length > 0) {
            console.log('需要删除的单词ID:', wordIdsToDelete);
            
            const { error: deleteError } = await supabase
              .from('words')
              .delete()
              .in('id', wordIdsToDelete);
            
            if (deleteError) {
              console.error('删除多余单词失败:', deleteError);
            } else {
              console.log(`成功删除 ${wordIdsToDelete.length} 个多余单词`);
            }
          }
        }
      }
      
      console.log('单词对齐处理完成');
    } catch (error) {
      console.error('单词对齐失败:', error);
    }
  }
  
  /**
   * 从文本中提取单词（简单实现）
   * 只提取字母和数字组成的单词，忽略标点符号
   */
  private static extractWords(text: string): string[] {
    if (!text) return [];
    // 匹配所有单词（连续的字母和数字，可能包含连字符和撇号）
    const wordMatches = text.match(/[a-zA-Z0-9]+(?:[''-][a-zA-Z0-9]+)*/g);
    return wordMatches || [];
  }

  /**
   * 将对齐摘要输出到日志
   */
  private static async logAlignmentSummaryToTerminal(
    blockId: string,
    speechId: string,
    originalBlockContent: string,
    result: AlignmentResult
  ) {
    try {
      // 使用安全的日志函数
      const log = (text: string) => {
        // 在浏览器环境中使用console.log
        console.log(text);
      };
      
      log(`- 时间: ${new Date().toLocaleString()}`);
      log(`- 语境块ID: ${blockId}`);
      log(`- 语音ID: ${speechId}`);
      
      // 打印原始语境块内容预览
      const contentPreview = originalBlockContent.length > 200 
        ? originalBlockContent.substring(0, 200) + '...' 
        : originalBlockContent;
      log(`\n【原始语境块内容预览】:\n${contentPreview}`);
      
      // 打印对齐的句子信息
      log(`\n【对齐句子 (共${result.alignedSentences.length}个)】:`);
      
      for (let i = 0; i < result.alignedSentences.length; i++) {
        const sentence = result.alignedSentences[i];
        log(`\n# 句子 ${i+1}:`);
        log(`- 句子ID: ${sentence.sentenceId}`);
        log(`- 时间: ${sentence.beginTime} → ${sentence.endTime}`);
        log(`- 原始文本: "${sentence.originalText}"`);
        log(`- 对齐文本: "${sentence.alignedText}"`);
        
        // 获取并打印单词级变更
        await this.logWordChangesToTerminal(sentence.sentenceId);
      }
      
      // 打印剩余未对齐文本
      if (result.remainingText) {
        const remainingPreview = result.remainingText.length > 200 
          ? result.remainingText.substring(0, 200) + '...' 
          : result.remainingText;
        log(`\n【剩余未对齐文本 (${result.remainingText.length}字符)】:\n${remainingPreview}`);
      } else {
        log(`\n【剩余未对齐文本】: 无剩余文本，全部完成对齐`);
      }
      
      // 添加一个简洁版本便于复制
      log(`\n========== 简洁对齐摘要(易复制) ==========`);
      for (let i = 0; i < result.alignedSentences.length; i++) {
        const s = result.alignedSentences[i];
        log(`单词${i+1}: id=${s.sentenceId}, 内容="${s.alignedText}", 开始时间=${s.beginTime}, 结束时间=${s.endTime}`);
      }
      log(`========== 简洁摘要结束 ==========`);
      
    } catch (error) {
      console.error('输出对齐摘要失败:', error);
    }
  }
  
  /**
   * 将单词级变更输出到日志
   */
  private static async logWordChangesToTerminal(sentenceId: string) {
    try {
      // 使用安全的日志函数
      const log = (text: string) => {
        console.log(text);
      };
      
      // 获取单词变更信息
      const { data: words, error } = await supabase
        .from('words')
        .select('*')
        .eq('sentence_id', sentenceId)
        .order('begin_time');
      
      if (error || !words || words.length === 0) {
        log(`- 单词变更: 无单词级数据`);
        return;
      }
      
      log(`- 单词变更 (${words.length}个):`);
      
      // 创建表格格式的输出
      log(`  序号 | 原单词       | 对齐单词     | 开始时间  | 结束时间`);
      log(`  -----|------------|------------|----------|----------`);
      
      words.forEach((word, index) => {
        const originalWord = (word.original_word || '(无)').padEnd(12);
        const alignedWord = (word.word || '(无)').padEnd(12);
        log(`  ${(index+1).toString().padEnd(4)} | ${originalWord} | ${alignedWord} | ${word.begin_time.toString().padEnd(8)} | ${word.end_time}`);
      });
    } catch (error) {
      console.log(`- 单词变更: 获取单词数据失败`);
    }
  }
} 