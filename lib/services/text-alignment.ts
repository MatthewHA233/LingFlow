import { supabase } from '@/lib/supabase-client';
import * as stringSimilarity from 'string-similarity';
import { WordAlignmentService } from './word-alignment';

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
      
      // 对齐前恢复块文本内容（如果是带标记的内容需要还原）
      let cleanBlockContent = blockData.content;
      
      // 处理已经包含句子标记的情况，移除所有[[id]]标记
      if (blockData.content.includes('[[') && blockData.content.includes(']]')) {
        cleanBlockContent = blockData.content.replace(/\[\[[^\]]+\]\]/g, '');
        console.log('清理了已有句子标记，恢复原始文本:', cleanBlockContent);
      }
      
      // 更新当前文本为清理后的内容
      let currentText = cleanBlockContent;
      console.log('当前块文本:', currentText);
      
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
      
      // 3. 开始对齐过程 - 新的对齐算法
      console.log('4. 开始逐句对齐');
      let currentPosition = 0; // 跟踪当前处理位置
      let orderIndex = 0;
      
      // 处理第一个句子 - 可能需要寻找匹配位置
      const firstSentence = sentencesData[0];
      console.log(`\n处理第一个句子:`, {
        id: firstSentence.id,
        text: firstSentence.text_content
      });
      
      // 检查第一个句子是否应该从头开始匹配
      const firstSentenceText = this.normalizeText(firstSentence.text_content);
      const blockStartText = this.normalizeText(currentText.substring(0, Math.min(firstSentenceText.length * 2, currentText.length)));
      
      const startingSimilarity = stringSimilarity.compareTwoStrings(
        firstSentenceText.substring(0, Math.min(20, firstSentenceText.length)),
        blockStartText.substring(0, Math.min(20, blockStartText.length))
      );
      
      console.log(`首句与块开头相似度: ${startingSimilarity.toFixed(2)}`);
      
      let matchResult;
      // 如果开头相似度较低，尝试在文本中找到最佳位置
      if (startingSimilarity < 0.6) {
        console.log('首句与块开头相似度低，尝试在文本中查找匹配位置');
        matchResult = this.findSentenceStartPosition(firstSentence.text_content, currentText);
        currentPosition = matchResult.startIndex;
      } else {
        // 直接从开头匹配
        console.log('首句与块开头相似度高，直接从开头开始匹配');
        matchResult = this.findSentenceEndPosition(firstSentence.text_content, currentText, 0);
      }
      
      console.log('首句匹配结果:', {
        startPosition: currentPosition,
        endPosition: currentPosition + (matchResult.matchedText?.length || 0),
        matchedText: matchResult.matchedText ? 
                    (matchResult.matchedText.length > 50 ? 
                     matchResult.matchedText.substring(0, 50) + '...' : 
                     matchResult.matchedText) : '无匹配'
      });
      
      // 如果匹配度过低，停止对齐
      if (matchResult.score < 0.6) {
        console.log('首句匹配度过低(低于0.6)，停止对齐');
        result.remainingText = currentText;
        return result;
      }
      
      // 添加第一个句子到结果
      const firstAlignedText = matchResult.matchedText || "";
      result.alignedSentences.push({
        sentenceId: firstSentence.id,
        originalText: firstSentence.text_content,
        alignedText: firstAlignedText,
        beginTime: firstSentence.begin_time,
        endTime: firstSentence.end_time,
        orderIndex: orderIndex++
      });
      
      // 更新当前位置到第一个句子的结束位置
      currentPosition += firstAlignedText.length;
      
      // 处理后续句子 - 线性对齐，每个句子从上一个句子结束的地方开始
      for (let i = 1; i < sentencesData.length; i++) {
        const sentence = sentencesData[i];
        console.log(`\n处理第 ${i+1} 个句子:`, {
          id: sentence.id,
          text: sentence.text_content
        });
        
        // 检查是否还有足够的文本
        if (currentPosition >= currentText.length) {
          console.log('当前块文本已用完，停止对齐');
          result.remainingText = null;
          break;
        }
        
        // 获取剩余文本
        const remainingText = currentText.substring(currentPosition);
        console.log(`剩余文本(前50字符): ${remainingText.substring(0, 50)}${remainingText.length > 50 ? '...' : ''}`);
        
        // 查找句子在剩余文本中的结束位置
        console.log('计算句子在剩余文本中的结束位置');
        const endMatchResult = this.findSentenceEndPosition(
          sentence.text_content,
          remainingText,
          0 // 从剩余文本的开头开始
        );
        
        console.log('句子匹配结果:', {
          score: endMatchResult.score,
          matchedText: endMatchResult.matchedText ? 
                      (endMatchResult.matchedText.length > 50 ? 
                       endMatchResult.matchedText.substring(0, 50) + '...' : 
                       endMatchResult.matchedText) : '无匹配'
        });
        
        // 如果匹配度过低，停止对齐
        if (endMatchResult.score < 0.6) {
          console.log('句子匹配度过低(低于0.6)，停止当前对齐');
          result.remainingText = remainingText;
          break;
        }
        
        // 提取对齐文本
        const alignedText = endMatchResult.matchedText || "";
        
        // 添加到结果中
        result.alignedSentences.push({
          sentenceId: sentence.id,
          originalText: sentence.text_content,
          alignedText: alignedText,
          beginTime: sentence.begin_time,
          endTime: sentence.end_time,
          orderIndex: orderIndex++
        });
        
        // 更新当前位置
        currentPosition += alignedText.length;
      }
      
      // 设置剩余文本
      if (currentPosition < currentText.length) {
        result.remainingText = currentText.substring(currentPosition);
      }
      
      console.log('\n5. 对齐过程完成');
      console.log(`成功对齐 ${result.alignedSentences.length} 个句子`);
      console.log('剩余未对齐文本长度:', result.remainingText ? result.remainingText.length : 0);
      
      // 确认是否真正执行更新
      const shouldExecuteUpdates = true; // 这里可以根据需要设置为false
      if (shouldExecuteUpdates) {
        console.log('\n7. 执行实际数据库更新');
        
        // 1. 先更新语境块和句子基础数据，但不包括元数据关联
        await this.saveBlockAndSentencesData(blockId, speechId, blockData.content, result);
        
        // 2. 然后立即处理单词级对齐
        console.log('\n8. 处理单词级对齐');
        for (const sentence of result.alignedSentences) {
          console.log(`处理句子 ${sentence.sentenceId} 的单词对齐`);
          await WordAlignmentService.alignWordsForSentence(sentence.sentenceId, sentence.alignedText);
        }
        
        // 3. 最后创建元数据关联，此时单词数据已更新
        console.log('\n9. 创建句子-块关联和元数据');
        await this.createMetadataAndLinksAfterAlignment(blockId, speechId, blockData.content, result);

        // 在任何情况下，都输出对齐摘要到终端
        console.log('\n========================= 对齐摘要 =========================');
        await this.logAlignmentSummaryToTerminal(blockId, speechId, blockData.content, result);
        console.log('=============================================================');
      } else {
        console.log('\n7. 跳过实际数据库更新（仅记录日志）');
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
   * 查找句子在文本中的开始位置（适用于第一个句子）
   */
  private static findSentenceStartPosition(sentenceText: string, blockText: string) {
    try {
      console.log('【寻找句子开始位置】:');
      console.log(`- 句子文本: ${sentenceText}`);
      console.log(`- 块文本长度: ${blockText.length}`);
      
      // 预处理文本
      const normalizedSentence = this.normalizeText(sentenceText);
      const normalizedBlock = this.normalizeText(blockText);
      
      // 检查块文本是否以引号开头
      const startsWithQuote = /^["'"]/.test(blockText.trim());
      
      // 使用句子的前N个字符进行匹配，但排除引号
      const sentenceStart = sentenceText.replace(/^["'"]/, '').trim();
      const prefixLength = Math.min(30, sentenceStart.length);
      const sentencePrefix = this.normalizeText(sentenceStart.substring(0, prefixLength));
      
      console.log(`- 使用句子前缀查找起始位置: "${sentencePrefix}"`);
      
      let bestScore = 0;
      let bestStartIndex = 0;
      
      // 在块文本中滑动窗口，查找最佳的起始位置
      const searchText = startsWithQuote ? normalizedBlock.replace(/^["'"]/, '').trim() : normalizedBlock;
      for (let i = 0; i <= searchText.length - prefixLength; i++) {
        const blockSegment = searchText.substring(i, i + prefixLength);
        const score = stringSimilarity.compareTwoStrings(sentencePrefix, blockSegment);
        
        if (score > bestScore) {
          bestScore = score;
          bestStartIndex = i;
        }
      }
      
      // 如果块文本以引号开头，且匹配位置很靠前，确保包含开头引号
      if (startsWithQuote && bestStartIndex <= 3) {
        bestStartIndex = 0; // 从真正的开头开始，包含引号
      }
      
      console.log(`- 找到最佳起始位置: ${bestStartIndex}, 分数: ${bestScore.toFixed(2)}`);
      
      // 从找到的起始位置确定句子的结束位置
      const endResult = this.findSentenceEndPosition(sentenceText, blockText, bestStartIndex);
      
      return {
        score: endResult.score,
        startIndex: bestStartIndex,
        matchedText: endResult.matchedText
      };
    } catch (error) {
      console.error('查找句子开始位置失败:', error);
      return { score: 0, startIndex: 0, matchedText: null };
    }
  }
  
  /**
   * 查找句子在文本中的结束位置（从指定位置开始匹配）
   */
  private static findSentenceEndPosition(sentenceText: string, blockText: string, startPosition: number) {
    try {
      console.log('【查找句子结束位置】:');
      console.log(`- 句子文本: ${sentenceText}`);
      console.log(`- 开始位置: ${startPosition}`);
      
      // 如果起始位置已经超出文本范围，直接返回失败
      if (startPosition >= blockText.length) {
        return { score: 0, matchedText: null };
      }
      
      // 预处理文本
      const normalizedSentence = this.normalizeText(sentenceText);
      const availableText = blockText.substring(startPosition);
      const normalizedAvailable = this.normalizeText(availableText);
      
      // 计算基本的句子长度和扩展长度
      const basicLength = normalizedSentence.length;
      
      // 首先检查原句是否以句号等标点结尾
      const endsWithPunctuation = /[.!?,;:"'）】）』」》][\s"']*$/.test(sentenceText);
      
      // 调整扩展长度，确保能够包含完整句子
      let extendedLength = Math.min(
        // 如果句子以标点结尾，给予更多余量，确保能找到句号
        endsWithPunctuation ? Math.round(basicLength * 1.5) : Math.round(basicLength * 1.3),
        normalizedAvailable.length
      );
      
      // 如果原句以句号结尾，则尝试在可用文本中找到下一个句号位置
      if (endsWithPunctuation) {
        // 从基本长度位置开始寻找下一个句号
        let searchStart = Math.max(0, basicLength - 10); // 稍微往前一点找
        let punctIndex = -1;
        
        // 检查各种可能的句子结束标点
        ['.', '!', '?', ',', ';', ':', '"', "'"].forEach(punct => {
          const idx = availableText.indexOf(punct, searchStart);
          if (idx > -1 && (punctIndex === -1 || idx < punctIndex)) {
            punctIndex = idx;
          }
        });
        
        // 如果找到了标点，且在合理范围内
        if (punctIndex > -1 && punctIndex < basicLength * 2) {
          extendedLength = punctIndex + 1; // 包含标点
          
          // 特殊处理：如果是引号，尝试找到匹配的闭合引号
          if (availableText[punctIndex] === '"' || availableText[punctIndex] === "'") {
            const nextQuote = availableText.indexOf(availableText[punctIndex], punctIndex + 1);
            if (nextQuote > -1 && nextQuote < punctIndex + 20) { // 合理范围内有闭合引号
              extendedLength = nextQuote + 1; // 扩展到闭合引号
            }
          }
          
          // 如果标点后有空格，也包含它
          if (punctIndex + 1 < availableText.length && availableText[punctIndex + 1] === ' ') {
            extendedLength++;
          }
        }
      }
      
      // 尝试不同的长度匹配，找到最佳结束位置
      let bestScore = 0;
      let bestEndLength = 0;
      
      // 先尝试基本长度
      const basicMatch = normalizedAvailable.substring(0, basicLength);
      bestScore = stringSimilarity.compareTwoStrings(normalizedSentence, basicMatch);
      bestEndLength = basicLength;
      
      console.log(`- 基本长度匹配分数: ${bestScore.toFixed(2)}`);
      
      // 然后尝试扩展长度
      if (extendedLength > basicLength) {
        const extendedMatch = normalizedAvailable.substring(0, extendedLength);
        const extendedScore = stringSimilarity.compareTwoStrings(normalizedSentence, extendedMatch);
        
        console.log(`- 扩展长度匹配分数: ${extendedScore.toFixed(2)}`);
        
        if (extendedScore > bestScore) {
          bestScore = extendedScore;
          bestEndLength = extendedLength;
        }
      }
      
      // 如果分数太低，再尝试更短的匹配
      if (bestScore < 0.6 && basicLength > 20) {
        console.log('- 尝试使用更短的匹配');
        for (let length = basicLength - 5; length >= Math.max(10, basicLength * 0.7); length -= 5) {
          const shorterMatch = normalizedAvailable.substring(0, length);
          const shorterScore = stringSimilarity.compareTwoStrings(
            normalizedSentence.substring(0, length), 
            shorterMatch
          );
          
          if (shorterScore > bestScore) {
            bestScore = shorterScore;
            bestEndLength = length;
          }
        }
      }
      
      // 如果分数仍然太低，放弃匹配
      if (bestScore < 0.4) {
        console.log('- 匹配分数过低，放弃匹配');
        return { score: bestScore, matchedText: null };
      }
      
      // 获取原始匹配文本
      let matchedText = availableText.substring(0, bestEndLength);
      
      // 优化句子边界
      matchedText = this.optimizeSentenceBoundary(matchedText);
      
      // 新增: 使用精确边界匹配进一步优化
      matchedText = this.findExactSentenceEnd(sentenceText, matchedText);
      
      console.log(`- 最终匹配文本: "${matchedText.substring(0, 50)}${matchedText.length > 50 ? '...' : ''}"`);
      
      return {
        score: bestScore,
        matchedText: matchedText
      };
    } catch (error) {
      console.error('查找句子结束位置失败:', error);
      return { score: 0, matchedText: null };
    }
  }
  
  /**
   * 优化句子边界，确保句子边界合理
   */
  private static optimizeSentenceBoundary(text: string): string {
    if (!text) return '';
    
    // 检查文本是否以完整句子结束（句号、问号、感叹号）
    const sentenceEndingMatch = text.match(/[.!?]["'\s]*$/);
    if (sentenceEndingMatch) {
      // 已经是一个完整句子，不需要进一步处理
      return text;
    }
    
    // 查找最后一个句子结束符号
    const lastPeriodIndex = Math.max(
      text.lastIndexOf('. '),
      text.lastIndexOf('! '),
      text.lastIndexOf('? ')
    );
    
    // 查找最后一个逗号或分号
    const lastCommaIndex = Math.max(
      text.lastIndexOf(', '),
      text.lastIndexOf('; ')
    );
    
    // 如果找到了句子结束符号，并且它不在文本的开头附近
    if (lastPeriodIndex > text.length * 0.5) {
      // 截取到这个句子结束符号后
      return text.substring(0, lastPeriodIndex + 2);
    }
    
    // 如果找到了逗号或分号，尝试在那里截断
    if (lastCommaIndex > text.length * 0.75) {
      return text.substring(0, lastCommaIndex + 2);
    }
    
    // 检查是否有未闭合的引号
    const quoteCount = (text.match(/["'"]/g) || []).length;
    if (quoteCount % 2 !== 0) {
      // 有未闭合的引号，手动查找引号位置
      let quotePositions: number[] = [];
      const quoteRegex = /["'"]/g;
      let match: RegExpExecArray | null;
      
      // 手动收集所有引号位置
      while ((match = quoteRegex.exec(text)) !== null) {
        quotePositions.push(match.index);
      }
      
      // 检查是否有足够的引号
      if (quotePositions.length > 1) {
        const lastButOneQuotePos = quotePositions[quotePositions.length - 2];
        if (lastButOneQuotePos > text.length * 0.5) {
          return text.substring(0, lastButOneQuotePos + 1);
        }
      }
    }
    
    // 如果上述方法都不适用，保留原始文本
    return text;
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
   * 保存语境块和句子基础数据（不包括元数据关联）
   */
  private static async saveBlockAndSentencesData(
    blockId: string,
    speechId: string,
    originalText: string,
    result: AlignmentResult
  ) {
    try {
      console.log('【开始保存基础数据】');
      
      // 如果没有对齐成功，提前返回
      if (!result.alignedSentences || result.alignedSentences.length === 0) {
        console.log('没有对齐成功的句子，跳过保存');
        return;
      }
      
      // 1. 计算各个分段位置及区域
      // 第一个句子的对齐位置用于确定"对齐前文本"
      const firstSentence = result.alignedSentences[0];
      const lastSentence = result.alignedSentences[result.alignedSentences.length - 1];
      
      // 查找第一个对齐句子在原文中的位置
      const firstSentenceIndex = originalText.indexOf(firstSentence.alignedText);
      
      // 提取对齐前文本
      const prefixText = firstSentenceIndex > 0 ? originalText.substring(0, firstSentenceIndex) : '';
      
      // 构建新的内容格式: 对齐前文本 + [[对齐的句子id]] + 剩余未对齐文本
      let newContent = prefixText;
      
      // 添加所有对齐的句子标识符
      for (const sentence of result.alignedSentences) {
        newContent += `[[${sentence.sentenceId}]]`;
      }
      
      // 添加剩余未对齐文本
      if (result.remainingText) {
        newContent += result.remainingText;
      }
      
      // 确定转换状态
      let conversionStatus = 'completed';
      if ((prefixText && prefixText.trim().length > 0) || (result.remainingText && result.remainingText.trim().length > 0)) {
        conversionStatus = 'partially_converted';
      }
      
      // 创建转换元数据
      const conversionMetadata = {
        alignment_date: new Date().toISOString(),
        alignment_method: 'string_similarity',
        aligned_sentences_count: result.alignedSentences.length,
        total_original_text_length: originalText.length,
        aligned_text_length: result.alignedSentences.reduce((sum, s) => sum + s.alignedText.length, 0),
        prefix_text_length: prefixText.length,
        remaining_text_length: result.remainingText ? result.remainingText.length : 0
      };
      
      // 2. 更新语境块
      console.log('更新语境块:', blockId);
      const updateData = {
        block_type: 'audio_aligned',
        speech_id: speechId,
        begin_time: firstSentence.beginTime,
        end_time: lastSentence.endTime,
        original_content: originalText,
        content: newContent,
        conversion_status: conversionStatus,
        conversion_metadata: conversionMetadata
      };
      
      console.log('更新数据:', updateData);
      
      // 使用单次数据库操作更新块
      const { data: blockUpdateData, error: blockUpdateError } = await supabase
        .from('context_blocks')
        .update(updateData)
        .eq('id', blockId);
      
      if (blockUpdateError) {
        console.error('更新语境块失败:', blockUpdateError);
        throw new Error(`更新语境块失败: ${blockUpdateError.message}`);
      }
      
      console.log('语境块更新成功');
      
      // 3. 更新句子的文本内容
      console.log('更新句子数据:');
      
      // 准备批量句子更新
      const sentenceUpdates = [];
      
      for (const sentence of result.alignedSentences) {
        // 首先获取该句子的所有单词数据
        const { data: words, error: wordsError } = await supabase
          .from('words')
          .select('*')
          .eq('sentence_id', sentence.sentenceId)
          .order('begin_time');

        if (wordsError) {
          console.error('获取单词数据失败:', wordsError);
          continue;
        }

        // 构建 word_history
        const word_history = words?.map(word => ({
          word: word.word,
          begin_time: word.begin_time,
          end_time: word.end_time,
          original_word: word.original_word || null
        })) || [];

        // 构建 alignment_metadata
        const alignment_metadata = {
          word_history,
          alignment_date: new Date().toISOString(),
          alignment_method: "string_similarity",
          algorithm_version: "1.0"
        };

        // 添加句子更新任务
        sentenceUpdates.push(
          supabase
            .from('sentences')
            .update({
              original_text_content: sentence.originalText,
              text_content: sentence.alignedText,
              conversion_status: 'converted',
              alignment_metadata  // 添加 alignment_metadata
            })
            .eq('id', sentence.sentenceId)
        );
      }
      
      // 并行执行所有句子更新
      console.log(`执行 ${sentenceUpdates.length} 个句子更新`);
      const sentenceResults = await Promise.all(sentenceUpdates);
      
      // 检查更新结果
      const sentenceErrors = sentenceResults.filter(r => r.error);
      if (sentenceErrors.length > 0) {
        console.error(`${sentenceErrors.length} 个句子更新失败`);
      }
      
      console.log('基础数据保存成功');
    } catch (error) {
      console.error('保存基础数据失败:', error);
      throw error;
    }
  }

  /**
   * 创建元数据和句子-块关联（在单词对齐之后）
   */
  private static async createMetadataAndLinksAfterAlignment(
    blockId: string,
    speechId: string,
    originalText: string,
    result: AlignmentResult
  ) {
    try {
      console.log('【开始创建元数据和关联】');
      
      // 创建句子-块关联
      console.log('创建句子-块关联:');
      const blockSentenceLinks = [];
      
      for (const sentence of result.alignedSentences) {
        // 计算句子在原始文本中的偏移量
        const alignedTextIndex = originalText.indexOf(sentence.alignedText);
        const segmentBeginOffset = alignedTextIndex >= 0 ? alignedTextIndex : 0;
        const segmentEndOffset = alignedTextIndex >= 0 ? alignedTextIndex + sentence.alignedText.length : 0;
        
        // 获取对齐分数
        const alignmentScore = stringSimilarity.compareTwoStrings(
          this.normalizeText(sentence.originalText), 
          this.normalizeText(sentence.alignedText)
        );
        
        // 现在单词对齐已完成，获取最新的单词元数据
        const wordChangesMetadata = await this.getWordChangeMetadata(sentence.sentenceId, sentence.alignedText);
        
        // 创建对齐元数据
        const alignmentMetadata = {
          alignment_summary: {
            original_text: sentence.originalText,
            aligned_text: sentence.alignedText,
            time_range: `${sentence.beginTime}~${sentence.endTime}`,
            character_count: sentence.alignedText.length,
            alignment_date: new Date().toISOString()
          },
          word_changes: wordChangesMetadata,
          alignment_method: "string_similarity",
          algorithm_version: "1.0"
        };
        
        // 创建块-句子关联
        blockSentenceLinks.push(
          supabase
            .from('block_sentences')
            .insert({
              block_id: blockId,
              sentence_id: sentence.sentenceId,
              order_index: sentence.orderIndex,
              alignment_score: alignmentScore,
              segment_begin_offset: segmentBeginOffset,
              segment_end_offset: segmentEndOffset,
              alignment_metadata: alignmentMetadata
            })
        );
      }
      
      // 并行执行所有关联创建
      console.log(`执行 ${blockSentenceLinks.length} 个关联创建`);
      const linkResults = await Promise.all(blockSentenceLinks);
      
      // 检查更新结果
      const linkErrors = linkResults.filter(r => r.error);
      if (linkErrors.length > 0) {
        console.error(`${linkErrors.length} 个关联创建失败`);
      }
      
      console.log('元数据和关联创建成功');
    } catch (error) {
      console.error('创建元数据和关联失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取单词级变更的元数据
   */
  private static async getWordChangeMetadata(sentenceId: string, alignedText: string) {
    try {
      // 获取单词数据
      const { data: words, error } = await supabase
        .from('words')
        .select('*')
        .eq('sentence_id', sentenceId)
        .order('begin_time');
      
      if (error || !words || words.length === 0) {
        return { word_count: 0, words: [] };
      }
      
      // 构建单词变更信息 - 修改后不再使用后备值
      const wordChanges = words.map((word, index) => ({
        index,
        original: word.original_word,  // 直接使用original_word，可能为null
        aligned: word.word,
        time_range: `${word.begin_time}~${word.end_time}`
      }));
      
      return {
        word_count: words.length,
        words: wordChanges
      };
    } catch (error) {
      console.error('获取单词变更元数据失败:', error);
      return { word_count: 0, words: [] };
    }
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
        log(`\n## 句子 ${i+1}:`);
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
   * 精确匹配句子边界，避免边界溢出
   */
  private static findExactSentenceEnd(sentenceText: string, matchedText: string): string {
    // 如果已经完全匹配了，直接返回
    if (this.normalizeText(matchedText) === this.normalizeText(sentenceText)) {
      return matchedText;
    }
    
    // 将句子按词拆分
    const sentenceWords = sentenceText.split(/\s+/);
    if (sentenceWords.length === 0) return matchedText;
    
    // 检查句子的最后部分是否有精确匹配
    // 从完整句子开始，逐渐缩小范围
    for (let endWordCount = sentenceWords.length; endWordCount > 0; endWordCount--) {
      // 获取句子最后N个单词组成的短语
      const endPhrase = sentenceWords.slice(sentenceWords.length - endWordCount).join(' ');
      if (endPhrase.length < 4) continue; // 短语太短跳过
      
      // 在匹配文本中查找这个短语的最后出现位置
      const phraseIndex = matchedText.lastIndexOf(endPhrase);
      if (phraseIndex >= 0) {
        // 找到匹配，截取到短语结束的位置
        const endPosition = phraseIndex + endPhrase.length;
        
        // 查找后续的标点和引号
        const newEndPosition = this.findPunctuationAfterEnd(matchedText, endPosition);
        
        return matchedText.substring(0, newEndPosition);
      }
    }
    
    // 如果没找到精确匹配，再尝试单个单词匹配
    const lastWord = sentenceWords[sentenceWords.length - 1];
    if (lastWord.length >= 3) { // 避免太短的单词
      const lastWordIndex = matchedText.lastIndexOf(lastWord);
      if (lastWordIndex >= 0) {
        const endPosition = lastWordIndex + lastWord.length;
        
        // 同样改进标点符号和引号处理
        let newEndPosition = endPosition;
        let i = endPosition;
        
        while (i < matchedText.length && i < endPosition + 5) {
          const char = matchedText[i];
          if (/[.,;:!?"'）】）』」》]/.test(char)) {
            newEndPosition = i + 1;
            i++;
          } else if (/\s/.test(char) && i === endPosition) {
            newEndPosition = i + 1;
            i++;
          } else if (!/\s/.test(char)) {
            break;
          } else {
            break;
          }
        }
        
        return matchedText.substring(0, newEndPosition);
      }
    }
    
    // 如果上述方法都失败，保留原始匹配
    return matchedText;
  }

  /**
   * 查找句子结束位置后的标点符号和引号
   */
  private static findPunctuationAfterEnd(text: string, position: number): number {
    if (position >= text.length) return position;
    
    let endPos = position;
    let foundPunctuation = false;
    let foundClosingQuote = false;
    
    // 检查最多5个字符
    for (let i = position; i < Math.min(text.length, position + 5); i++) {
      const char = text[i];
      
      // 处理标点
      if (/[.!?,;:]/.test(char)) {
        endPos = i + 1;
        foundPunctuation = true;
        continue;
      }
      
      // 处理引号
      if (/["'"]/.test(char)) {
        // 如果已经找到标点，或者这是唯一要处理的字符
        if (foundPunctuation || i === position) {
          endPos = i + 1;
          foundClosingQuote = true;
          continue;
        }
      }
      
      // 允许空格继续
      if (/\s/.test(char) && (foundPunctuation || foundClosingQuote)) {
        continue;
      }
      
      // 遇到其他字符停止
      if (foundPunctuation || foundClosingQuote) {
        break;
      }
      
      break;
    }
    
    return endPos;
  }
} 