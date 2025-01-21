import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '洪流二语习得 - 革新性语言学习平台',
  description: '借助智能化"词锚点域"与大语言模型，构建属于你自己习得语料的宇宙！',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className={cn(inter.className, "min-h-screen antialiased")} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}