import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '洪流二语习得 - 革新性语言学习平台',
  description: '让您的语言学习如洪流般自然流畅',
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