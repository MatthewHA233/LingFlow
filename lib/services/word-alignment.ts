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
   * 创建原始单词到对齐单词的映射（优化版）
   */
  private static createAlignmentMap(
    dbWords: any[], 
    originalWords: string[], 
    alignedWords: string[]
  ): Map<number, {targetIndices: number[], similarityScore: number}> {
    console.time('创建映射-预计算相似度矩阵');
    // 映射: 原始单词索引 -> {目标单词索引数组, 相似度得分}
    const alignmentMap = new Map<number, {targetIndices: number[], similarityScore: number}>();
    
    // 位置权重计算
    function calculatePositionWeight(origIndex: number, alignedIndex: number) {
      // 相对位置
      const origPosition = origIndex / originalWords.length;
      const alignedPosition = alignedIndex / alignedWords.length;
      
      // 位置差异惩罚（差异越大，得分越低）
      const positionDiff = Math.abs(origPosition - alignedPosition);
      const positionScore = 1 - positionDiff;
      
      return positionScore;
    }
    
    // 预计算相似度矩阵，避免重复计算
    const similarityMatrix: number[][] = [];
    for (let i = 0; i < originalWords.length; i++) {
      similarityMatrix[i] = [];
      const originalWord = originalWords[i].toLowerCase();
      
      for (let j = 0; j < alignedWords.length; j++) {
        const alignedWord = alignedWords[j].toLowerCase();
        const textSimilarity = stringSimilarity.compareTwoStrings(originalWord, alignedWord);
        
        // 结合文本相似度和位置相似度（位置权重占30%）
        const positionWeight = 0.3;
        const positionScore = calculatePositionWeight(i, j);
        const combinedScore = (textSimilarity * (1 - positionWeight)) + 
                             (positionScore * positionWeight);
        
        similarityMatrix[i][j] = combinedScore;
      }
    }
    console.timeEnd('创建映射-预计算相似度矩阵');
    
    // 记录已分配的对齐单词索引
    const assignedAlignedIndices = new Set<number>();
    
    // 贪心算法：先处理最高相似度的匹配
    console.time('创建映射-收集匹配候选');
    const candidateMatches: Array<{
      originalIndex: number,
      alignedIndex: number,
      similarity: number
    }> = [];
    
    // 收集所有可能的单词匹配
    for (let i = 0; i < originalWords.length; i++) {
      for (let j = 0; j < alignedWords.length; j++) {
        if (similarityMatrix[i][j] > 0.5) { // 只考虑相似度较高的匹配
          candidateMatches.push({
            originalIndex: i,
            alignedIndex: j,
            similarity: similarityMatrix[i][j]
          });
        }
      }
    }
    console.timeEnd('创建映射-收集匹配候选');
    
    // 按相似度降序排序
    console.time('创建映射-处理一对一匹配');
    candidateMatches.sort((a, b) => b.similarity - a.similarity);
    
    // 处理一对一匹配
    for (const match of candidateMatches) {
      if (!alignmentMap.has(match.originalIndex) && 
          !assignedAlignedIndices.has(match.alignedIndex)) {
        
        alignmentMap.set(match.originalIndex, {
          targetIndices: [match.alignedIndex],
          similarityScore: match.similarity
        });
        
        assignedAlignedIndices.add(match.alignedIndex);
      }
    }
    console.timeEnd('创建映射-处理一对一匹配');
    
    // 处理未分配的原始单词 - 尝试组合匹配
    console.time('创建映射-处理复杂匹配');
    for (let i = 0; i < originalWords.length; i++) {
      if (alignmentMap.has(i)) continue;
      
      const originalWord = originalWords[i].toLowerCase();
      
      // 尝试将原始单词与多个未分配的对齐单词匹配
      let bestMultiMatch = {
        indices: [] as number[],
        similarity: 0
      };
      
      // 只考虑最多3个连续单词的组合
      for (let startIdx = 0; startIdx < alignedWords.length; startIdx++) {
        if (assignedAlignedIndices.has(startIdx)) continue;
        
        for (let count = 1; count <= 3 && startIdx + count - 1 < alignedWords.length; count++) {
          // 检查这些单词是否都未分配
          let allAvailable = true;
          for (let j = 0; j < count; j++) {
            if (assignedAlignedIndices.has(startIdx + j)) {
              allAvailable = false;
              break;
            }
          }
          
          if (!allAvailable) continue;
          
          // 组合单词并计算相似度
          let combined = '';
          for (let j = 0; j < count; j++) {
            combined += alignedWords[startIdx + j].toLowerCase();
          }
          
          const similarity = stringSimilarity.compareTwoStrings(originalWord, combined);
          
          if (similarity > bestMultiMatch.similarity) {
            bestMultiMatch.similarity = similarity;
            bestMultiMatch.indices = [];
            for (let j = 0; j < count; j++) {
              bestMultiMatch.indices.push(startIdx + j);
            }
          }
        }
      }
      
      // 如果找到较好的多词匹配
      if (bestMultiMatch.similarity > 0.5 && bestMultiMatch.indices.length > 0) {
        alignmentMap.set(i, {
          targetIndices: bestMultiMatch.indices,
          similarityScore: bestMultiMatch.similarity
        });
        
        bestMultiMatch.indices.forEach(idx => assignedAlignedIndices.add(idx));
      }
    }
    
    // 处理未分配的对齐单词 - 尝试将多个原始单词组合匹配到一个对齐单词
    for (let j = 0; j < alignedWords.length; j++) {
      if (assignedAlignedIndices.has(j)) continue;
      
      const alignedWord = alignedWords[j].toLowerCase();
      
      // 尝试将多个连续的未分配原始单词与此对齐单词匹配
      let bestMultiOriginalMatch = {
        indices: [] as number[],
        similarity: 0
      };
      
      // 只考虑最多3个连续原始单词的组合
      for (let startIdx = 0; startIdx < originalWords.length; startIdx++) {
        if (alignmentMap.has(startIdx)) continue;
        
        for (let count = 1; count <= 3 && startIdx + count - 1 < originalWords.length; count++) {
          // 检查这些单词是否都未分配
          let allAvailable = true;
          for (let i = 0; i < count; i++) {
            if (alignmentMap.has(startIdx + i)) {
              allAvailable = false;
              break;
            }
          }
          
          if (!allAvailable) continue;
          
          // 组合单词并计算相似度
          let combined = '';
          for (let i = 0; i < count; i++) {
            combined += originalWords[startIdx + i].toLowerCase();
          }
          
          const similarity = stringSimilarity.compareTwoStrings(combined, alignedWord);
          
          if (similarity > bestMultiOriginalMatch.similarity) {
            bestMultiOriginalMatch.similarity = similarity;
            bestMultiOriginalMatch.indices = [];
            for (let i = 0; i < count; i++) {
              bestMultiOriginalMatch.indices.push(startIdx + i);
            }
          }
        }
      }
      
      // 如果找到较好的多词匹配
      if (bestMultiOriginalMatch.similarity > 0.5 && bestMultiOriginalMatch.indices.length > 0) {
        for (const idx of bestMultiOriginalMatch.indices) {
          alignmentMap.set(idx, {
            targetIndices: [j],
            similarityScore: bestMultiOriginalMatch.similarity / bestMultiOriginalMatch.indices.length
          });
        }
        
        assignedAlignedIndices.add(j);
      }
    }
    
    // 简单处理剩余未分配的原始单词和对齐单词
    // 未分配的原始单词设为删除
    for (let i = 0; i < originalWords.length; i++) {
      if (!alignmentMap.has(i)) {
        alignmentMap.set(i, {
          targetIndices: [],
          similarityScore: 0
        });
      }
    }
    
    return alignmentMap;
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
