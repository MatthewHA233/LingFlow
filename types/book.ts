export interface Chapter {
  title: string;
  content: string;
}

export interface Resource {
  href: string;
  'media-type'?: string;
  id?: string;
  exists?: boolean;
  type?: string;
}

export interface ResourceManifest {
  [key: string]: Resource;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  cover_url: string;
  description?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  epub_path: string;
  audio_path: string;
  progress?: number;
  last_position?: string;
  metadata?: {
    language?: string;
    publisher?: string;
    published_date?: string;
    isbn?: string;
  };
  chapters: Chapter[];
  coverUrl?: string;
  resources?: {
    manifest: ResourceManifest;
  };
}

export interface BookProgress {
  book_id: string;
  user_id: string;
  progress: number;
  last_position: string;
  updated_at: string;
}

declare module 'epubjs' {
  interface Package {
    metadata?: {
      path?: string;
    };
  }

  interface SpineItem {
    href: string;
    idref?: string;
  }

  interface Spine {
    items: SpineItem[];
  }

  interface Book {
    loaded: {
      package?: Package;
      spine: Promise<Spine>;
      metadata: Promise<any>;
      manifest: Promise<any>;
      cover: Promise<string>;
      navigation: Promise<any>;
      resources: Promise<any>;
    };
    navigation?: {
      toc: Array<{
        href: string;
        label: string;
      }>;
    };
  }
}