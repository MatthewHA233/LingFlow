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
          startIndex: matchResult.position,
          matchedText: matchResult.text ? 
                      (matchResult.text.length > 50 ? 
                       matchResult.text.substring(0, 50) + '...' : 
                       matchResult.text) : '无匹配'
        });
        
        // 如果匹配度过低，停止当前对齐
        if (matchResult.score < 0.6) {
          console.log('匹配度过低(低于0.6)，停止对齐');
          result.remainingText = currentText;
          break;
        }
        
        // 提取对齐文本
        const alignedText = matchResult.text;
        
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
        const newStartIndex = matchResult.position + alignedText.length;
        console.log(`4.3 更新剩余文本，从位置 ${newStartIndex} 开始截取`);
        currentText = currentText.substring(newStartIndex);
        console.log('剩余文本(前100字符):', currentText.substring(0, 100) + (currentText.length > 100 ? '...' : ''));
      }
      
      // 处理剩余文本
      if (result.remainingText && result.remainingText.length < 50) {
        const remainingResult = this.processRemainingShortText(result.remainingText);
        if (remainingResult && remainingResult.success) {
          // 获取最后一个句子的时间
          const lastSentence = result.alignedSentences[result.alignedSentences.length - 1];
          const lastEndTime = lastSentence ? lastSentence.endTime : 0;
          
          // 计算合理的时间间隔（使用1000ms而不是之前的500ms）
          const timeGap = 1000;
          const duration = Math.min(result.remainingText.length * 50, 2000); // 根据文本长度动态计算
          
          // 添加剩余文本
          result.alignedSentences.push({
            sentenceId: 'remaining-' + Date.now(),
            originalText: result.remainingText,
            alignedText: remainingResult.text,
            beginTime: lastEndTime + timeGap,
            endTime: lastEndTime + timeGap + duration,
            orderIndex: orderIndex++
          });
          result.remainingText = '';
        }
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
        const shouldExecuteUpdates = true; // 这里可以根据需要设置为false
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
   * 增强版文本匹配算法
   */
  private static findBestTextMatch(sentenceText: string, blockText: string): TextMatchResult {
    try {
      console.log(' 【文本匹配计算】:');
      console.log(` - 句子文本: ${sentenceText.substring(0, 120)}`);
      console.log(` - 块文本长度: ${blockText.length}`);
      
      // 1. 先尝试短句优化
      if (sentenceText.trim().length <= 15) {
        const shortResult = this.optimizeShortSentenceMatch(sentenceText, blockText);
        if (shortResult) {
          console.log(` - 使用短句特殊匹配算法，得分：${shortResult.score.toFixed(2)}`);
          return shortResult;
        }
      }
      
      // 预处理并保留原始格式
      const originalSentence = sentenceText.trim();
      const sentenceLower = originalSentence.toLowerCase();
      const blockLower = blockText.toLowerCase();
      
      // 记录原始句子的标点特征
      const hasPeriod = /[.!?]$/.test(originalSentence.trim());
      const hasQuestion = originalSentence.includes('?');
      const isCapitalized = /^[A-Z]/.test(originalSentence.trim());
      
      // 尝试不同窗口大小进行匹配
      const baseWindowSize = sentenceLower.length;
    const windowSizes = [
        baseWindowSize,
        baseWindowSize + 5,
        baseWindowSize + 10,
        Math.floor(baseWindowSize * 1.2)
      ];
      
      console.log(` - 尝试不同窗口大小进行匹配`);
      console.log(` - 窗口大小: ${windowSizes.join(', ')}`);
      console.log(` - 各窗口最佳匹配:`);
      
      let bestScore = 0;
      let bestPosition = 0;
      let bestWindowSize = 0;
      
    for (const windowSize of windowSizes) {
        if (windowSize > blockLower.length) continue;
        
        let currentBestScore = 0;
        let currentBestPosition = 0;
        
        for (let i = 0; i <= blockLower.length - windowSize; i++) {
          const blockSubstring = blockLower.substring(i, i + windowSize);
          const score = this.calculateStringSimilarity(sentenceLower, blockSubstring);
          
          if (score > currentBestScore) {
            currentBestScore = score;
            currentBestPosition = i;
          }
        }
        
        console.log(`   窗口大小 ${windowSize}: 分数 ${currentBestScore.toFixed(2)}, 匹配文本: "${blockLower.substring(currentBestPosition, currentBestPosition + windowSize).substring(0, 50)}..."`);
        
        if (currentBestScore > bestScore) {
          bestScore = currentBestScore;
          bestPosition = currentBestPosition;
          bestWindowSize = windowSize;
        }
      }
      
      console.log(` - 最终最佳匹配: 分数 ${bestScore.toFixed(2)}, 位置 ${bestPosition}~${bestPosition + bestWindowSize}`);
      
      // 高级边界优化
      if (bestScore >= 0.6) {
        // 获取匹配文本，使用原始大小写
        let matchedText = blockText.substring(bestPosition, bestPosition + bestWindowSize);
        
        // 1. 应用大小写保留
        matchedText = this.preserveCapitalization(originalSentence, matchedText);
        
        // 2. 标点符号恢复
        if (hasPeriod && !matchedText.trim().endsWith('.') && 
            !matchedText.trim().endsWith('!') && 
            !matchedText.trim().endsWith('?')) {
          // 查找结束标点
          for (let i = bestPosition + bestWindowSize; 
               i < Math.min(bestPosition + bestWindowSize + 20, blockText.length); i++) {
            if (['.', '!', '?'].includes(blockText[i])) {
              matchedText = blockText.substring(bestPosition, i + 1);
              break;
            }
          }
          
          // 如果没找到，加上句号
          if (!matchedText.trim().endsWith('.') && 
              !matchedText.trim().endsWith('!') && 
              !matchedText.trim().endsWith('?')) {
            matchedText = matchedText + '.';
          }
        }
        
        // 3. 特殊处理问号
        matchedText = this.preserveSpecialPunctuation(originalSentence, matchedText, blockText, bestPosition);
        
        // 4. 处理前导/尾随空格
        matchedText = matchedText.trim();
        
        // 5. 整合句子边界检测
        let bestEndPos = bestPosition + matchedText.length;
        for (let i = bestPosition + matchedText.length - 1; 
             i < Math.min(bestPosition + matchedText.length + 25, blockText.length); i++) {
          if (this.isSentenceBoundary(blockText, i)) {
            bestEndPos = i + 1; // +1包含边界字符
            break;
          }
        }
        
        // 应用改进后的文本边界
        if (bestEndPos > bestPosition + matchedText.length) {
          matchedText = blockText.substring(bestPosition, bestEndPos);
        }
        
        // 对于"A thousand..."这种特殊情况，强制检查首字母
        if (originalSentence.trim().length > 0 && 
            originalSentence.trim()[0] === 'A' && 
            matchedText.trim().length > 0 && 
            matchedText.trim()[0] === 'a') {
          matchedText = 'A' + matchedText.substring(1);
        }
    
    return {
          score: bestScore,
          text: matchedText.trim(), // 确保无前导/尾随空格
          position: bestPosition,
          success: bestScore >= 0.6
        };
      }
      
      return { score: 0, text: '', position: -1, success: false };
    } catch (error) {
      console.error('文本匹配计算出错:', error);
      return { score: 0, text: '', position: -1, success: false };
    }
  }
  
  /**
   * 处理特殊标点符号
   */
  private static preserveSpecialPunctuation(sourceText: string, matchedText: string, blockText: string, startPos: number): string {
    // 1. 问号特殊处理
    if (sourceText.includes('?') && !matchedText.includes('?')) {
      // 在块文本中查找距离匹配位置最近的问号
      const nearbyQuestionMark = blockText.indexOf('?', startPos);
      if (nearbyQuestionMark >= 0 && nearbyQuestionMark < startPos + matchedText.length + 15) {
        // 扩展匹配文本到包含问号
        return blockText.substring(startPos, nearbyQuestionMark + 1);
      } else {
        // 如果块文本中没有附近问号，则在匹配文本末尾添加问号
        // 但要先移除已有的其他末尾标点
        const trimmed = matchedText.replace(/[.!,;:]$/, '');
        return trimmed + '?';
      }
    }
    return matchedText;
  }
  
  /**
   * 保留原始大小写
   */
  private static preserveCapitalization(sourceText: string, matchedText: string): string {
    // 如果源文本为空或匹配文本为空，直接返回
    if (!sourceText || !sourceText.trim() || !matchedText) return matchedText;
    
    let result = matchedText;
    
    // 1. 检查首字母大写
    if (sourceText.trim().length > 0 && /^[A-Z]/.test(sourceText.trim())) {
      if (result.length > 0) {
        // 确保首字母大写
        result = result.charAt(0).toUpperCase() + result.substring(1);
      }
    }
    
    // 2. 处理专有名词 (优先级更高的常见单词)
    const properNouns = ['I', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 
                        'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 
                        'May', 'June', 'July', 'August', 'September', 'October', 
                        'November', 'December', 'English', 'French', 'Chinese', 
                        'American', 'European', 'African', 'Asian', 'Australia'];
                        
    for (const noun of properNouns) {
      // 使用单词边界确保只匹配整个单词
      const regex = new RegExp(`\\b${noun.toLowerCase()}\\b`, 'g');
      result = result.replace(regex, noun);
    }
    
    return result;
  }
  
  /**
   * 专门优化短句匹配
   */
  private static optimizeShortSentenceMatch(sentence: string, blockText: string): TextMatchResult {
    // 短句定义为<=15个字符
    if (sentence.trim().length <= 15) {
      // 使用更宽松的匹配方式
      const sentenceLower = sentence.trim().toLowerCase();
      // 注意：下面改用replaceAll而不是replace，确保所有标点都被移除
      const sentenceCore = sentenceLower.replaceAll(/[.,?!;:]/g, '').trim(); 
      const blockLower = blockText.toLowerCase();
      
      // 检查原始句子是否有问号
      const hasQuestion = sentence.includes('?');
      
      // 1. 尝试精确匹配
      const exactPos = blockLower.indexOf(sentenceLower);
      if (exactPos >= 0) {
        // 找到完全匹配，完全保留原形式
        return {
          score: 1.0,
          text: sentence.trim(), // 直接使用原始输入句子
          position: exactPos,
          success: true
        };
      }
      
      // 2. 尝试核心文本匹配(不含标点)
      const corePos = blockLower.indexOf(sentenceCore);
      if (corePos >= 0) {
        // 找到核心匹配，构建匹配文本
        let matchedText = "";
        
        // 基本匹配文本
        matchedText = blockText.substring(corePos, corePos + sentenceCore.length);
        
        // 保留原始大小写
        if (/^[A-Z]/.test(sentence.trim()) && matchedText.length > 0) {
          matchedText = matchedText.charAt(0).toUpperCase() + matchedText.substring(1);
        }
        
        // 处理问号 - 这是关键改进
        if (hasQuestion) {
          // 在块中查找附近的问号
          const qPos = blockText.indexOf('?', corePos);
          if (qPos >= 0 && qPos < corePos + sentenceCore.length + 15) {
            // 扩展文本到包含问号
            matchedText = blockText.substring(corePos, qPos + 1);
          } else {
            // 如果没找到，手动添加问号
            matchedText = matchedText + "?";
          }
        }
        
        return {
          score: 0.95,
          text: matchedText,
          position: corePos,
          success: true
        };
      }
    }
    
    return null; // 未找到匹配
  }
  
  /**
   * 尝试对剩余短文本做最终对齐
   */
  private static processRemainingShortText(remainingText: string): TextMatchResult {
    if (remainingText && remainingText.length < 50) {
      const trimmed = remainingText.trim();
      
      // 如果是对话或引述的一部分
      if (trimmed.startsWith('"') || trimmed.startsWith("'") ||
          trimmed.includes(':') || trimmed.includes('"') || 
          trimmed.startsWith(',')) { // 添加对逗号开头的检测
        return {
          score: 0.9,
          text: trimmed,
          position: -1, // 特殊标记
          success: true
        };
      }
    }
    
    return null;
  }
  
  /**
   * 检查文本中是否有不平衡的标点符号
   */
  private static hasMismatchedPunctuationInText(text: string): boolean {
    if (!text) return false;
    
    // 检查成对的标点符号
    const pairs = [
      ['"', '"'],
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
      ['\u2019', '\u2019'], // 单引号
      ['\u00AB', '\u00BB']  // «»
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
   * 计算两个字符串的相似度（0-1之间）
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    // 如果其中一个字符串为空，返回0
    if (!str1 || !str2) return 0;
    
    // 如果字符串完全相同，返回1
    if (str1 === str2) return 1;
    
    // 使用Dice系数计算相似度
    // 拆分为字符对(bigrams)
    const getBigrams = (string: string) => {
      const bigrams = new Set<string>();
      for (let i = 0; i < string.length - 1; i++) {
        bigrams.add(string.substring(i, i + 2));
      }
      return bigrams;
    };
    
    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);
    
    // 计算交集大小
    let intersection = 0;
    for (const bigram of bigrams1) {
      if (bigrams2.has(bigram)) {
        intersection++;
      }
    }
    
    // 计算相似度系数
    return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
  }
  
  /**
   * 改进的边界优化算法
   */
  private static optimizeMatchBoundariesImproved(
    originalText: string, 
    startIndex: number, 
    endIndex: number,
    sourceText: string
  ): string {
    // 获取初步匹配的文本
    let matchedText = originalText.substring(startIndex, endIndex);
    
    // 记录标点符号的原始状态
    const sourcePunctuation = this.extractPunctuation(sourceText);
    
    // 1. 保留原始大小写 - 已在findBestTextMatch实现
    
    // 2. 处理结束标点
    const endingPunctuation = ['.', '?', '!', ';'];
    // 检查源文本是否以标点结束
    const endsWithPunctuation = endingPunctuation.some(p => sourceText.trim().endsWith(p));
    
    if (endsWithPunctuation) {
      // 查找右侧结束标点
      const hasMatchedEndPunctuation = endingPunctuation.some(p => matchedText.trim().endsWith(p));
      
      if (!hasMatchedEndPunctuation) {
        // 向右查找15个字符以内的结束标点
        for (let i = endIndex; i < Math.min(endIndex + 15, originalText.length); i++) {
          if (endingPunctuation.includes(originalText[i])) {
            // 扩展匹配以包含标点
            matchedText = originalText.substring(startIndex, i + 1);
          break;
          }
        }
      }
    }
    
    // 3. 处理前导空格和引号
    // 如果原文本有前导空格但匹配文本没有，且不是段落开始
    if (sourceText.startsWith(' ') && !matchedText.startsWith(' ') && startIndex > 0) {
      if (originalText[startIndex-1] === ' ') {
        matchedText = ' ' + matchedText;
      }
    }
    
    // 4. 处理问号和感叹号等特殊标点
    if (sourcePunctuation.includes('?') && !matchedText.includes('?')) {
      // 尝试在匹配的右侧附近查找问号
      const questionMarkIndex = originalText.indexOf('?', startIndex);
      if (questionMarkIndex > 0 && questionMarkIndex < endIndex + 10) {
        matchedText = originalText.substring(startIndex, questionMarkIndex + 1);
      }
    }
    
    // 5. 使用句子边界函数处理复杂情况
    let finalBoundary = endIndex;
    for (let i = endIndex; i < Math.min(endIndex + 20, originalText.length); i++) {
      if (this.isSentenceBoundary(originalText, i)) {
        finalBoundary = i;
        break;
      }
    }
    
    if (finalBoundary > endIndex) {
      matchedText = originalText.substring(startIndex, finalBoundary);
    }
    
    return matchedText;
  }
  
  /**
   * 提取文本中的标点符号
   */
  private static extractPunctuation(text: string): string[] {
    if (!text) return [];
    const punctuation = text.match(/[.,\/#!$%\^&\*;:{}=\-_`~()"\[\]]/g);
    return punctuation || [];
  }
  
  /**
   * 规范化文本用于对比
   */
  private static normalizeText(text: string): string {
    if (!text) return '';
    
    // 1. 先保留原始大小写和标点进行匹配
    let normalized = text.trim();
    
    // 2. 只在相似度计算时转换为小写
    return normalized.toLowerCase();
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
      
      // 修复标签错误
      log(`\n========== 简洁对齐摘要(易复制) ==========`);
      for (let i = 0; i < result.alignedSentences.length; i++) {
        const s = result.alignedSentences[i];
        // 将"单词"改为"句子"
        log(`句子${i+1}: id=${s.sentenceId}, 内容="${s.alignedText}", 开始时间=${s.beginTime}, 结束时间=${s.endTime}`);
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

  /**
   * 更智能的句子边界检测
   */
  private static isSentenceBoundary(text: string, position: number): boolean {
    // 检查是否是句子边界的更复杂逻辑
    if (position <= 0 || position >= text.length) return false;
    
    const currentChar = text[position];
    const prevChar = text[position - 1];
    const nextChar = position < text.length - 1 ? text[position + 1] : '';
    
    // 1. 常规句子结束符后跟空格或引号
    if (['.', '!', '?'].includes(prevChar) && 
        (currentChar === ' ' || currentChar === '"' || currentChar === "'")) {
      return true;
    }
    
    // 2. 某些缩写处理（如Mr., Dr.等）
    const abbreviations = ['mr.', 'dr.', 'ms.', 'mrs.', 'prof.', 'etc.', 'e.g.', 'i.e.'];
    for (const abbr of abbreviations) {
      const pos = position - abbr.length;
      if (pos >= 0) {
        const potentialAbbr = text.substring(pos, position).toLowerCase();
        if (potentialAbbr === abbr && currentChar === ' ') {
          return false; // 这是缩写，不是句子边界
        }
      }
    }
    
    return false;
  }

  /**
   * 提高多句对齐完整性
   */
  private static attemptToAlignRemainingText(
    remainingText: string, 
    speechId: string
  ): Promise<AlignedSentence[]> {
    // 如果剩余文本较短，尝试与下一个句子对齐
    if (remainingText && remainingText.length < 50) {
      // 查找下一个可能的句子
      return this.findNextSentenceAndAlign(remainingText, speechId);
    }
    return Promise.resolve([]);
  }
} 