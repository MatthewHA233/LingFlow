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
  metadata: {
    color?: string;
    icon?: string;
    [key: string]: any;
  };
  status: 'active' | 'archived' | 'deleted';
  last_accessed_at?: string;
  note_count: number;
  notes?: Note[];
  // 临时UI状态
  isDeleting?: boolean;
} 