import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/components/auth/AuthProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '洪流二语习得 - 革新性语言学习平台',
  description: '借助智能化"词锚点域"与大语言模型，构建属于你自己习得语料的宇宙！',
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: 'any'
      },
      {
        url: '/icon.png',
        type: 'image/png',
        sizes: '512x512'
      }
    ],
    apple: [
      {
        url: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png'
      }
    ]
  },
  manifest: '/manifest.json',
  openGraph: {
    title: '洪流二语习得 - 革新性语言学习平台',
    description: '借助智能化"词锚点域"与大语言模型，构建属于你自己习得语料的宇宙！',
    type: 'website',
    locale: 'zh_CN',
    url: 'https://lf.cc-ty.net.cn',
    siteName: '洪流二语习得',
    images: [
      {
        url: 'https://lf.cc-ty.net.cn/og-image.png',
        width: 1200,
        height: 630,
        alt: '洪流二语习得 - 革新性语言学习平台'
      }
    ]
  },
  other: {
    'wechat-title': '洪流二语习得 - 革新性语言学习平台',
    'wechat-description': '借助智能化"词锚点域"与大语言模型，构建属于你自己习得语料的宇宙！',
    'wechat-image': 'https://lf.cc-ty.net.cn/og-image.png'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={cn(inter.className, 'min-h-screen bg-background')}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}