import { Book as EpubBook } from 'epubjs';

// 书籍类型枚举
export type BookType = 'book' | 'notebook';

// 书籍状态枚举
export type BookStatus = 'processing' | 'ready' | 'error';

export interface Navigation {
  toc: Array<{
    href: string;
    label: string;
  }>;
}

export interface Chapter {
  id: string;
  title: string;
  order_index: number;
  book_id: string;
  parent_id: string;
  content?: string; // 向后兼容，新版使用context_blocks
  created_at: string;
  updated_at: string;
  contentParent?: {
    id: string;
    content_type: string;
    title: string;
    description?: string;
    contextBlocks: Array<{
      id: string;
      block_type: string;
      content: string;
      order_index: number;
      metadata?: Record<string, any>;
      begin_time?: number | null;
      end_time?: number | null;
      speech_id?: string | null;
      original_content?: string | null;
      conversion_status?: string;
      conversion_metadata?: Record<string, any>;
    }>;
  };
  showBlockDetails?: boolean; // 用于UI中控制是否显示块详情
}

export interface Resource {
  href: string;
  'media-type'?: string;
  id?: string;
  oss_url?: string;
}

export interface ResourceManifest {
  [key: string]: Resource;
}

export interface ChapterStatistics {
  chapter_id: string;
  chapter_title: string;
  order_index: number;
  block_count: number;
  text_block_count: number;
  heading_block_count: number;
  image_block_count: number;
  audio_block_count: number;
}

export interface BookStatistics {
  chapter_count: number;
  text_block_count: number;
  heading_block_count: number;
  image_block_count: number;
  audio_block_count: number;
  total_block_count: number;
  chapter_statistics: ChapterStatistics[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  cover_url?: string;
  description?: string;
  epub_path?: string; // 对于笔记本类型，这个字段可能为空
  audio_path?: string; // 对于笔记本类型，这个字段可能为空
  user_id: string;
  created_at: string;
  updated_at: string;
  last_read_at?: string;
  last_position?: Record<string, any>;
  type: BookType; // 新增：书籍类型
  status: BookStatus; // 扩展状态选项
  note_count: number; // 新增：章节/页面计数
  last_accessed_at?: string; // 新增：最后访问时间
  metadata: {
    language?: string;
    publisher?: string;
    published_date?: string;
    [key: string]: any;
  };
  chapters?: Chapter[]; // 可选，用于包含章节数据
  
  // 临时属性，仅用于上传过程或UI状态
  coverUrl?: string;
  resources?: {
    manifest: ResourceManifest;
    imageFiles?: Array<{
      id: string;
      href: string;
      'media-type'?: string;
      type?: string;
    }>;
  };
  progress?: number;
  isDeleting?: boolean;
  stats?: BookStatistics;
}

// 为了向后兼容，保留 Notebook 类型别名
export type Notebook = Book;

// 为了向后兼容，保留 CustomPage 类型别名
export type CustomPage = Chapter;

export interface BookProgress {
  book_id: string;
  user_id: string;
  progress: number;
  last_position: string;
  updated_at: string;
}

export interface ContentParent {
  id: string;
  content_type: 'chapter' | 'video' | 'custom_page' | 'collection';
  title: string;
  description?: string;
  metadata: {
    book_id?: string;
    chapter_index?: number;
    [key: string]: any;
  };
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ContextBlock {
  id: string;
  parent_id: string;
  block_type: 'text' | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'heading_5' | 'heading_6' | 'image';
  content: string;
  order_index: number;
  metadata?: {
    alt?: string;
    originalSrc?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

// PackagingManifestItem 类型定义
export interface PackagingManifestItem {
  href: string;
  'media-type'?: string;
  type?: string;
  id?: string;
  exists?: boolean;
}

// 创建书籍/笔记本的请求类型
export interface CreateBookRequest {
  title: string;
  author?: string;
  description?: string;
  cover_url?: string;
  type: BookType;
  metadata?: Record<string, any>;
  epub_path?: string;
  audio_path?: string;
}

// 更新书籍/笔记本的请求类型
export interface UpdateBookRequest {
  title?: string;
  author?: string;
  description?: string;
  cover_url?: string;
  status?: BookStatus;
  metadata?: Record<string, any>;
  epub_path?: string;
  audio_path?: string;
}

// 创建章节/页面的请求类型
export interface CreateChapterRequest {
  book_id: string;
  title: string;
  content?: string;
  order_index?: number;
}

// 更新章节/页面的请求类型
export interface UpdateChapterRequest {
  title?: string;
  content?: string;
  order_index?: number;
}

export type { EpubBook };