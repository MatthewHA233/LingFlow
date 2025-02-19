'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ContextLibrary() {
  const router = useRouter();

  useEffect(() => {
    router.push('/context-library/bookshelf');
  }, [router]);

  return null;
} 