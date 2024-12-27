import { BookOpen, Headphones, Network, Brain } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const FEATURES_DATA: Feature[] = [
  {
    icon: BookOpen,
    title: '智能文本分析',
    description: '自动分析文本难度，智能分段，让阅读更轻松'
  },
  {
    icon: Headphones,
    title: '音频同步对齐',
    description: '精确到单词级别的音频对齐，实现逐字朗读'
  },
  {
    icon: Network,
    title: '交互式学习',
    description: '点击任意文字即时播放对应音频，加深记忆'
  },
  {
    icon: Brain,
    title: '智能复习',
    description: '基于艾宾浩斯遗忘曲线，科学安排复习计划'
  }
];