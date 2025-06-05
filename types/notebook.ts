export interface Note {
  id: string;
  title: string;
  content?: string;
  notebook_id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  tags: string[];
  metadata: {
    [key: string]: any;
  };
}

export interface Notebook {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  metadata?: Record<string, any>;
  status: 'active' | 'archived' | 'deleted';
  last_accessed_at: string;
  note_count: number;
  
  // 扩展字段，用于UI状态
  isDeleting?: boolean;
  custom_pages?: CustomPage[];
}

export interface CustomPage {
  id: string;
  notebook_id: string;
  title: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  resources?: Record<string, any>;
  parent_id?: string;
  content?: string;
  tags?: string[];
  
  // 扩展字段，用于UI状态
  isEditing?: boolean;
  isDeleting?: boolean;
}

// 创建笔记本的请求类型
export interface CreateNotebookRequest {
  title: string;
  description?: string;
  cover_url?: string;
  metadata?: Record<string, any>;
}

// 更新笔记本的请求类型
export interface UpdateNotebookRequest {
  title?: string;
  description?: string;
  cover_url?: string;
  metadata?: Record<string, any>;
  status?: 'active' | 'archived' | 'deleted';
}

// 创建页面的请求类型
export interface CreatePageRequest {
  notebook_id: string;
  title: string;
  content?: string;
  tags?: string[];
  order_index?: number;
}

// 更新页面的请求类型
export interface UpdatePageRequest {
  title?: string;
  content?: string;
  tags?: string[];
  order_index?: number;
}

// 笔记本统计信息
export interface NotebookStats {
  total_notebooks: number;
  total_pages: number;
  recent_activity: {
    notebook_id: string;
    notebook_title: string;
    last_accessed_at: string;
  }[];
}

// 页面排序选项
export type PageSortOption = 
  | 'order_index'    // 按顺序索引
  | 'updated_at'     // 按更新时间
  | 'created_at'     // 按创建时间
  | 'title';         // 按标题

// 笔记本排序选项
export type NotebookSortOption = 
  | 'updated_at'     // 按更新时间
  | 'created_at'     // 按创建时间
  | 'title'          // 按标题
  | 'last_accessed_at'; // 按最后访问时间 