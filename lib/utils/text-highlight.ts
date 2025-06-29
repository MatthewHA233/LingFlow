import React from 'react';

/**
 * 文本高亮工具函数
 * 用于在例句中高亮显示对应的单词
 */

export interface HighlightOptions {
  className?: string;
  style?: React.CSSProperties;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

/**
 * 在文本中高亮显示指定的单词
 * @param text 原始文本
 * @param targetWord 要高亮的单词
 * @param options 高亮选项
 * @returns 包含高亮标记的JSX元素
 */
export function highlightWordInText(
  text: string, 
  targetWord: string, 
  options: HighlightOptions = {}
): React.ReactElement {
  const {
    className = 'font-bold underline text-red-400',
    style = {},
    caseSensitive = false,
    wholeWord = true
  } = options;

  if (!text || !targetWord) {
    return React.createElement('span', null, text);
  }

  // 构建正则表达式
  let pattern: string;
  if (wholeWord) {
    // 匹配完整单词，考虑各种边界情况
    pattern = `\\b${escapeRegExp(targetWord)}\\b`;
  } else {
    // 匹配任何出现的字符串
    pattern = escapeRegExp(targetWord);
  }

  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(pattern, flags);

  // 分割文本并高亮匹配的部分
  const parts = text.split(regex);
  const matches = text.match(regex) || [];

  if (matches.length === 0) {
    return React.createElement('span', null, text);
  }

  return React.createElement(
    'span',
    null,
    parts.map((part, index) => 
      React.createElement(
        React.Fragment,
        { key: index },
        part,
        index < matches.length && React.createElement(
          'span',
          { 
            className: className,
            style: style
          },
          matches[index]
        )
      )
    )
  );
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 智能高亮单词（处理单词的不同形式）
 * @param text 原始文本
 * @param targetWord 要高亮的单词
 * @param options 高亮选项
 * @returns 包含高亮标记的JSX元素
 */
export function smartHighlightWord(
  text: string,
  targetWord: string,
  options: HighlightOptions = {}
): React.ReactElement {
  // 先尝试精确匹配
  let result = highlightWordInText(text, targetWord, { ...options, wholeWord: true });
  
  // 如果没有匹配到，尝试匹配单词的不同形式
  if (!hasHighlight(text, targetWord, true)) {
    // 尝试小写匹配
    result = highlightWordInText(text, targetWord.toLowerCase(), { ...options, wholeWord: true, caseSensitive: false });
    
    // 如果还是没有匹配到，尝试匹配词根（去掉常见后缀）
    if (!hasHighlight(text, targetWord.toLowerCase(), false)) {
      const wordRoot = getWordRoot(targetWord);
      if (wordRoot !== targetWord) {
        result = highlightWordInText(text, wordRoot, { ...options, wholeWord: false, caseSensitive: false });
      }
    }
  }
  
  return result;
}

/**
 * 检查文本中是否包含指定单词
 */
function hasHighlight(text: string, targetWord: string, caseSensitive: boolean): boolean {
  const flags = caseSensitive ? 'g' : 'gi';
  const pattern = `\\b${escapeRegExp(targetWord)}\\b`;
  const regex = new RegExp(pattern, flags);
  return regex.test(text);
}

/**
 * 获取单词词根（简单版本，去掉常见后缀）
 */
function getWordRoot(word: string): string {
  const commonSuffixes = [
    'ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ness', 'ment', 
    'ful', 'less', 'able', 'ible', 'ous', 'ious', 'al', 'ial', 'ic',
    's', 'es', 'ies', 'd'
  ];
  
  let root = word.toLowerCase();
  
  for (const suffix of commonSuffixes.sort((a, b) => b.length - a.length)) {
    if (root.endsWith(suffix) && root.length > suffix.length + 2) {
      root = root.slice(0, -suffix.length);
      break;
    }
  }
  
  return root;
}

/**
 * 解析词性标签
 * @param tags 词性标签数组
 * @returns 格式化的词性字符串
 */
export function formatPartOfSpeech(tags: string[]): string {
  if (!tags || tags.length === 0) return '';
  
  // 词性映射表
  const posMap: Record<string, string> = {
    'noun': 'n.',
    'verb': 'v.',
    'adjective': 'adj.',
    'adverb': 'adv.',
    'pronoun': 'pron.',
    'preposition': 'prep.',
    'conjunction': 'conj.',
    'interjection': 'interj.',
    'article': 'art.',
    'determiner': 'det.',
    'modal': 'modal',
    'auxiliary': 'aux.',
    
    // 中文词性
    '名词': 'n.',
    '动词': 'v.',
    '形容词': 'adj.',
    '副词': 'adv.',
    '代词': 'pron.',
    '介词': 'prep.',
    '连词': 'conj.',
    '感叹词': 'interj.',
    '助词': '助',
    '量词': '量',
    
    // 常见缩写
    'n': 'n.',
    'v': 'v.',
    'adj': 'adj.',
    'adv': 'adv.',
    'prep': 'prep.',
    'conj': 'conj.',
    'pron': 'pron.'
  };
  
  return tags
    .map(tag => posMap[tag.toLowerCase()] || tag)
    .join(', ');
} 