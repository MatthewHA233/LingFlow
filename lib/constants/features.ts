import { BookOpen, Headphones, Network, Brain, Book, Sparkles, MessageCircle, Pen } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const FEATURES_DATA: Feature[] = [
  {
    icon: BookOpen,
    title: '智能文本对齐',
    description: '自动将电子书文本与有声书音频精确对齐，支持多种电子书格式，实现智能点读'
  },
  {
    icon: Headphones,
    title: 'AI语音生成',
    description: '采用先进的TTS技术，生成媲美人类的朗读音频，让每本书都能开口说话'
  },
  {
    icon: Book,
    title: '模块化点读器',
    description: '块级排版，支持块翻译、音频控制、各种循环等丰富功能，打造沉浸式学习体验'
  },
  {
    icon: Network,
    title: '词锚点迭代学习',
    description: '独创词锚点系统，交互丝滑，通过大模型建立语境联系含义，迭代学习，让学习更高效'
  },
  {
    icon: Brain,
    title: '智能复习系统',
    description: '基于语境记忆卡片的间隔重复算法，配合辨析集锦带来游戏化的仪式感，让进步可持续'
  },
  {
    icon: MessageCircle,
    title: 'AI情景对话',
    description: '智能角色扮演练习口语，活学活用已熟练的语料库语句，并充分通过口语老师复习语料造句'
  },
  {
    icon: Pen,
    title: '写作训练助手',
    description: '基于个人语料库的写作练习，支持听写检测和智能仿写，全方位提升写作能力'
  },
  {
    icon: Sparkles,
    title: '词锚点预生成',
    description: '基于用户数据智能预测生疏词汇，快速提取词锚点，到点读器右侧词云图作为待选清单'
  }
];