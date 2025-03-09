import { supabase } from '@/lib/supabase-client';
import * as stringSimilarity from 'string-similarity';

export class WordAlignmentService {
  /**
   * 为句子执行单词级对齐
   * 使用字符串相似度算法进行智能对齐
   */
  static async alignWordsForSentence(sentenceId: string, alignedText: string) {
    try {
      console.log(`【开始处理句子 ${sentenceId} 的单词对齐】`);
      console.time('单词对齐总耗时');
      
      // 1. 获取现有单词数据
      console.log('1. 获取现有单词数据');
      console.time('1-获取单词数据');
      const { data: words, error: wordsError } = await supabase
        .from('words')
        .select('*')
        .eq('sentence_id', sentenceId)
        .order('begin_time');
      console.timeEnd('1-获取单词数据');
      
      if (wordsError) {
        console.error('获取单词数据失败:', wordsError);
        throw new Error(`获取单词数据失败: ${wordsError.message}`);
      }
      
      console.log(`获取到 ${words?.length || 0} 个单词`);
      
      // 2. 获取句子的原始文本内容
      console.log('2. 获取句子原始文本');
      console.time('2-获取句子文本');
      const { data: sentence, error: sentenceError } = await supabase
        .from('sentences')
        .select('original_text_content')
        .eq('id', sentenceId)
        .single();
      console.timeEnd('2-获取句子文本');
      
      if (sentenceError) {
        console.error('获取句子原始文本失败:', sentenceError);
        throw new Error(`获取句子原始文本失败: ${sentenceError.message}`);
      }
      
      const originalText = sentence.original_text_content || '';
      console.log(`原始文本: "${originalText}"`);
      console.log(`对齐文本: "${alignedText}"`);
      
      // 3. 提取原始文本和对齐文本中的单词
      console.time('3-提取单词');
      const originalWords = this.extractWords(originalText);
      const alignedWords = this.extractWords(alignedText);
      console.timeEnd('3-提取单词');
      
      console.log('原始单词列表:', originalWords);
      console.log('对齐单词列表:', alignedWords);
      
      if (!words || words.length === 0) {
        console.log('没有现有单词数据，跳过单词对齐');
        return;
      }
      
      // 4. 执行智能单词对齐
      console.log('4. 执行智能单词对齐');
      
      // 创建对齐映射
      console.time('4.1-创建对齐映射');
      const alignmentMap = this.createAlignmentMap(words, originalWords, alignedWords);
      console.timeEnd('4.1-创建对齐映射');
      console.log('单词对齐映射:', alignmentMap);
      
      // 应用对齐结果
      console.time('4.2-应用对齐结果');
      await this.applyAlignmentResult(sentenceId, words, alignedWords, alignmentMap);
      console.timeEnd('4.2-应用对齐结果');
      
      console.timeEnd('单词对齐总耗时');
      console.log('单词对齐处理完成');
    } catch (error) {
      console.error('单词对齐失败:', error);
    }
  }
  
  /**
   * 创建原始单词到对齐单词的映射（顺序对齐改进版）
   */
  private static createAlignmentMap(
    dbWords: any[], 
    originalWords: string[], 
    alignedWords: string[]
  ): Map<number, {targetIndices: number[], similarityScore: number}> {
    console.time('创建映射-顺序对齐');
    // 映射: 原始单词索引 -> {目标单词索引数组, 相似度得分}
    const alignmentMap = new Map<number, {targetIndices: number[], similarityScore: number}>();
    
    // 记录已分配的对齐单词索引
    const assignedAlignedIndices = new Set<number>();
    
    // 顺序遍历两个单词列表
    let origIndex = 0;
    let alignIndex = 0;
    
    while (origIndex < originalWords.length && alignIndex < alignedWords.length) {
      const origWord = originalWords[origIndex].toLowerCase();
      const alignWord = alignedWords[alignIndex].toLowerCase();
      
      // 计算相似度
      const similarity = stringSimilarity.compareTwoStrings(origWord, alignWord);
      
      // 单词完全匹配或非常相似 (一对一)
      if (similarity > 0.8) {
        alignmentMap.set(origIndex, {
          targetIndices: [alignIndex],
          similarityScore: similarity
        });
        assignedAlignedIndices.add(alignIndex);
        origIndex++;
        alignIndex++;
        continue;
      }
      
      // 尝试检测拆分单词 (一对多) - "anyone" -> "any one"
      const splitWords = this.checkWordSplit(origWord, alignedWords, alignIndex);
      if (splitWords.found && splitWords.endIndex > alignIndex) {
        // 确保按顺序添加单词索引
        const targetIndices = [];
        for (let i = alignIndex; i <= splitWords.endIndex; i++) {
          targetIndices.push(i);
          assignedAlignedIndices.add(i);
        }
        
        alignmentMap.set(origIndex, {
          targetIndices: targetIndices,
          similarityScore: splitWords.similarity
        });
        
        // 更新索引位置
        origIndex++;
        alignIndex = splitWords.endIndex + 1;
        continue;
      }
      
      // 尝试检测合并单词 (多对一) - "any one" -> "anyone" 
      const mergedWords = this.checkWordMerge(originalWords, origIndex, alignWord);
      if (mergedWords.found && mergedWords.endIndex > origIndex) {
        // 将多个原始单词映射到同一个对齐单词
        for (let i = origIndex; i <= mergedWords.endIndex; i++) {
          alignmentMap.set(i, {
            targetIndices: [alignIndex],
            similarityScore: mergedWords.similarity / (mergedWords.endIndex - origIndex + 1)
          });
        }
        
        assignedAlignedIndices.add(alignIndex);
        origIndex = mergedWords.endIndex + 1;
        alignIndex++;
        continue;
      }
      
      // 处理可能的插入或删除
      // 首先检查是否为删除（原文有，对齐文本没有）
      if (origIndex + 1 < originalWords.length) {
        const nextOrigWord = originalWords[origIndex + 1].toLowerCase();
        const skipOrigSimilarity = stringSimilarity.compareTwoStrings(nextOrigWord, alignWord);
        
        if (skipOrigSimilarity > 0.7) {
          // 当前原始单词可能已被删除
          alignmentMap.set(origIndex, {
            targetIndices: [],
            similarityScore: 0
          });
          origIndex++;
          continue;
        }
      }
      
      // 检查是否为插入（原文没有，对齐文本有）
      if (alignIndex + 1 < alignedWords.length) {
        const nextAlignWord = alignedWords[alignIndex + 1].toLowerCase();
        const skipAlignSimilarity = stringSimilarity.compareTwoStrings(origWord, nextAlignWord);
        
        if (skipAlignSimilarity > 0.7) {
          // 当前对齐单词可能是插入的
          assignedAlignedIndices.add(alignIndex);
          alignIndex++;
          continue;
        }
      }
      
      // 默认情况：尝试一对一匹配（即使相似度不高）
      alignmentMap.set(origIndex, {
        targetIndices: [alignIndex],
        similarityScore: Math.max(0.3, similarity) // 给一个最低分数
      });
      assignedAlignedIndices.add(alignIndex);
      origIndex++;
      alignIndex++;
    }
    
    // 处理剩余单词
    while (origIndex < originalWords.length) {
      alignmentMap.set(origIndex, {
        targetIndices: [],
        similarityScore: 0
      });
      origIndex++;
    }
    
    console.timeEnd('创建映射-顺序对齐');
    return alignmentMap;
  }
  
  /**
   * 检查单词是否应该拆分为多个单词 (如 "anyone" -> "any one")
   */
  private static checkWordSplit(
    origWord: string,
    alignedWords: string[],
    startIndex: number
  ): {found: boolean, endIndex: number, similarity: number} {
    if (startIndex >= alignedWords.length - 1) {
      return {found: false, endIndex: startIndex, similarity: 0};
    }
    
    // 尝试2-3个连续单词的组合
    for (let count = 2; count <= 3 && startIndex + count - 1 < alignedWords.length; count++) {
      let combined = '';
      
      // 按顺序组合单词
      for (let i = 0; i < count; i++) {
        combined += alignedWords[startIndex + i].toLowerCase();
      }
      
      const similarity = stringSimilarity.compareTwoStrings(origWord.toLowerCase(), combined);
      
      if (similarity > 0.7) {
        return {
          found: true,
          endIndex: startIndex + count - 1,
          similarity: similarity
        };
      }
    }
    
    return {found: false, endIndex: startIndex, similarity: 0};
  }
  
  /**
   * 检查多个单词是否应该合并为一个单词 (如 "any one" -> "anyone")
   */
  private static checkWordMerge(
    originalWords: string[],
    startIndex: number,
    alignedWord: string
  ): {found: boolean, endIndex: number, similarity: number} {
    if (startIndex >= originalWords.length - 1) {
      return {found: false, endIndex: startIndex, similarity: 0};
    }
    
    // 尝试2-3个连续单词的组合
    for (let count = 2; count <= 3 && startIndex + count - 1 < originalWords.length; count++) {
      let combined = '';
      
      // 按顺序组合单词
      for (let i = 0; i < count; i++) {
        combined += originalWords[startIndex + i].toLowerCase();
      }
      
      const similarity = stringSimilarity.compareTwoStrings(combined, alignedWord.toLowerCase());
      
      if (similarity > 0.7) {
        return {
          found: true,
          endIndex: startIndex + count - 1,
          similarity: similarity
        };
      }
    }
    
    return {found: false, endIndex: startIndex, similarity: 0};
  }
  
  /**
   * 应用对齐结果到数据库（优化版）
   */
  private static async applyAlignmentResult(
    sentenceId: string,
    dbWords: any[],
    alignedWords: string[],
    alignmentMap: Map<number, {targetIndices: number[], similarityScore: number}>
  ) {
    console.time('应用结果-收集变更');
    // 收集所有需要保留的单词ID
    const wordIdsToKeep = new Set<string>();
    const wordUpdates: {id: string, update: any}[] = [];
    const newWords: any[] = [];
    
    // 使用单次循环收集所有变更
    Array.from(alignmentMap.entries()).forEach(([originalIndex, alignment]) => {
      if (originalIndex >= dbWords.length) return;
      
      const dbWord = dbWords[originalIndex];
      const { targetIndices, similarityScore } = alignment;
      
      if (targetIndices.length === 0) return; // 该单词将被删除
      
      if (targetIndices.length === 1) {
        // 一对一更新
        wordIdsToKeep.add(dbWord.id);
        wordUpdates.push({
          id: dbWord.id,
          update: {
            original_word: dbWord.word,
            word: alignedWords[targetIndices[0]]
          }
        });
            } else {
        // 一个原始单词拆分为多个对齐单词
        const totalDuration = dbWord.end_time - dbWord.begin_time;
        const segmentDuration = totalDuration / targetIndices.length;
        
        // 更新第一个单词
        wordIdsToKeep.add(dbWord.id);
        wordUpdates.push({
          id: dbWord.id,
          update: {
            original_word: dbWord.word,
            word: alignedWords[targetIndices[0]],
            end_time: dbWord.begin_time + segmentDuration
          }
        });
        
        // 创建其他拆分出的单词
        for (let i = 1; i < targetIndices.length; i++) {
          newWords.push({
            sentence_id: sentenceId,
            word: alignedWords[targetIndices[i]],
            original_word: '',
            begin_time: dbWord.begin_time + i * segmentDuration,
            end_time: i === targetIndices.length - 1 
              ? dbWord.end_time 
              : dbWord.begin_time + (i + 1) * segmentDuration
          });
        }
      }
    });
    console.timeEnd('应用结果-收集变更');
    
    // 处理未映射的对齐单词（需要新增）
    console.time('应用结果-处理未映射单词');
    const mappedAlignedIndices = new Set<number>();
    Array.from(alignmentMap.values()).forEach(alignment => {
      alignment.targetIndices.forEach(index => mappedAlignedIndices.add(index));
    });
    
    // 优化版本：只收集所有需要新增的单词
        for (let i = 0; i < alignedWords.length; i++) {
      if (!mappedAlignedIndices.has(i)) {
        // 计算未映射单词的插入位置和时间范围
        let beginTime, endTime;
        const wordDuration = 200; // 毫秒
        
        // 寻找最近的映射单词来决定插入位置
        // 简化版本：根据映射单词索引在数组中的位置决定插入位置
        const mappedIndices = Array.from(mappedAlignedIndices).sort((a, b) => a - b);
        let prevIndex = -1;
        let nextIndex = Number.MAX_SAFE_INTEGER;
        
        for (const idx of mappedIndices) {
          if (idx < i && idx > prevIndex) prevIndex = idx;
          if (idx > i && idx < nextIndex) nextIndex = idx;
        }
        
        if (prevIndex !== -1 && nextIndex !== Number.MAX_SAFE_INTEGER) {
          // 在两个映射单词之间插入
          let prevDbWordIndex = -1;
          let nextDbWordIndex = -1;
          
          Array.from(alignmentMap.entries()).forEach(([origIdx, align]) => {
            if (align.targetIndices.includes(prevIndex)) {
              prevDbWordIndex = origIdx;
            }
            if (align.targetIndices.includes(nextIndex)) {
              nextDbWordIndex = origIdx;
            }
          });
          
          if (prevDbWordIndex !== -1 && nextDbWordIndex !== -1 &&
              prevDbWordIndex < dbWords.length && nextDbWordIndex < dbWords.length) {
            const prevDbWord = dbWords[prevDbWordIndex];
            const nextDbWord = dbWords[nextDbWordIndex];
            
            // 均分这段时间
            const totalGap = nextDbWord.begin_time - prevDbWord.end_time;
            const gapCount = nextIndex - prevIndex - 1;
            const segmentDuration = totalGap / (gapCount + 1);
            
            beginTime = prevDbWord.end_time + segmentDuration * (i - prevIndex - 1);
            endTime = beginTime + segmentDuration;
          } else {
            beginTime = dbWords[dbWords.length - 1].end_time + (i * wordDuration);
            endTime = beginTime + wordDuration;
          }
        } else if (prevIndex !== -1) {
          // 在最后一个映射单词之后
          let prevDbWordIndex = -1;
          
          Array.from(alignmentMap.entries()).forEach(([origIdx, align]) => {
            if (align.targetIndices.includes(prevIndex)) {
              prevDbWordIndex = origIdx;
            }
          });
          
          if (prevDbWordIndex !== -1 && prevDbWordIndex < dbWords.length) {
            const prevDbWord = dbWords[prevDbWordIndex];
            beginTime = prevDbWord.end_time + ((i - prevIndex - 1) * wordDuration);
            endTime = beginTime + wordDuration;
          } else {
            beginTime = dbWords[dbWords.length - 1].end_time + (i * wordDuration);
            endTime = beginTime + wordDuration;
          }
        } else {
          // 在第一个映射单词之前
          beginTime = dbWords[0].begin_time - ((prevIndex - i) * wordDuration);
          endTime = beginTime + wordDuration;
        }
        
        newWords.push({
          sentence_id: sentenceId,
          word: alignedWords[i],
          original_word: '',
          begin_time: Math.max(0, beginTime),
          end_time: Math.max(wordDuration, endTime)
        });
      }
    }
    console.timeEnd('应用结果-处理未映射单词');
    
    // 批量数据库操作
    try {
      // 1. 批量删除多余的单词
      console.time('数据库-删除多余单词');
      const wordIdsToDelete = dbWords
        .filter(word => !wordIdsToKeep.has(word.id))
        .map(word => word.id);
          
          if (wordIdsToDelete.length > 0) {
            const { error: deleteError } = await supabase
              .from('words')
              .delete()
              .in('id', wordIdsToDelete);
            
            if (deleteError) {
          console.error('批量删除单词失败:', deleteError);
        }
      }
      console.timeEnd('数据库-删除多余单词');
      
      // 2. 批量更新现有单词（每50个一批）
      console.time('数据库-更新现有单词');
      const BATCH_SIZE = 50;
      for (let i = 0; i < wordUpdates.length; i += BATCH_SIZE) {
        const batch = wordUpdates.slice(i, i + BATCH_SIZE);
        const updatePromises = batch.map(({ id, update }) => 
          supabase.from('words').update(update).eq('id', id)
        );
        
        // 并行执行50个更新操作
        await Promise.all(updatePromises);
      }
      console.timeEnd('数据库-更新现有单词');
      
      // 3. 批量插入新单词（最多100个一批）
      console.time('数据库-添加新单词');
      if (newWords.length > 0) {
        for (let i = 0; i < newWords.length; i += 100) {
          const batch = newWords.slice(i, i + 100);
          const { error: insertError } = await supabase
            .from('words')
            .insert(batch);
          
          if (insertError) {
            console.error(`批量添加单词失败(批次${i/100+1}):`, insertError);
          }
        }
      }
      console.timeEnd('数据库-添加新单词');
    } catch (error) {
      console.error('批量数据库操作失败:', error);
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
}
