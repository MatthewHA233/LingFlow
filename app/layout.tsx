import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { RootProvider } from '@/components/providers/root-provider';

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
      <body className={inter.className}>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}