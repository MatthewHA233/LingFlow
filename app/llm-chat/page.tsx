'use client';

import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/auth';
import { UnauthorizedTip } from '@/components/auth/UnauthorizedTip';

// 使用动态导入避免SSR问题
const ChatWindow = dynamic(
  () => import('@/components/llm-chat/ChatWindow'),
  { ssr: false }
);

export default function ChatPage() {
  const { user } = useAuthStore();

  if (!user) {
    return <UnauthorizedTip />;
  }

  return (
    <div className="h-full">
      <ChatWindow />
    </div>
  );
} 