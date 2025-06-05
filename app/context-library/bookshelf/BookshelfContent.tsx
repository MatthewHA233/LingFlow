'use client';

import { useEffect, useState, useRef } from 'react';
import { Book } from '@/types/book';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase-client';
import BookshelfPage from './page';

// 使用单例模式缓存书架数据
let cachedBooksData: Book[] | null = null;
let cachedUserId: string | null = null;
let isLoading = false;

export default function BookshelfContent() {
  const { user } = useAuthStore();
  
  // 如果是同一用户且有缓存数据，使用缓存
  const shouldUseCache = user?.id === cachedUserId && cachedBooksData !== null;

  return (
    <div className="relative overflow-hidden rounded-xl p-[1px] mx-2 sm:mx-6 md:mx-8 lg:mx-12 xl:mx-16">
      <span className="absolute inset-0 bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
      <div className="relative bg-black/80 backdrop-blur-md rounded-xl p-0">
        <BookshelfPage key={shouldUseCache ? 'cached' : user?.id || 'no-user'} />
      </div>
    </div>
  );
} 