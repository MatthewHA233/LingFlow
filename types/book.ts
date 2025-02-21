import { Book as EpubBook } from 'epubjs';

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

export interface Book {
  id: string;
  title: string;
  author: string;
  cover_url: string;
  epub_path: string;
  audio_path: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  metadata: {
    language?: string;
    publisher?: string;
    published_date?: string;
    [key: string]: any;
  };
  chapters: Chapter[];
  // 临时属性，仅用于上传过程
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
}

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

export type { EpubBook };