'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, ThumbsUp, Share2, BookOpen, PlusCircle } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import Image from 'next/image';

interface ContextShare {
  id: string;
  title: string;
  content: string;
  tags: string[];
  author: {
    name: string;
    avatar: string;
  };
  likes: number;
  comments: number;
  shares: number;
  bookTitle: string;
  imageUrl: string;
}

const MOCK_SHARES: ContextShare[] = [
  {
    id: '1',
    title: '《挪威的森林》中的绝妙比喻',
    content: '在这段中，村上春树用了一个非常巧妙的比喻来描述人际关系...',
    tags: ['日语文学', '比喻', '村上春树'],
    author: {
      name: '语言达人',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1'
    },
    likes: 128,
    comments: 32,
    shares: 15,
    bookTitle: '挪威的森林',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c'
  },
  {
    id: '2',
    title: '英语中的文化差异表达',
    content: '今天在读《了不起的盖茨比》时，发现了一个很有趣的文化差异点...',
    tags: ['英语', '文化差异', '文学赏析'],
    author: {
      name: '文学探索者',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2'
    },
    likes: 89,
    comments: 24,
    shares: 8,
    bookTitle: '了不起的盖茨比',
    imageUrl: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73'
  },
  {
    id: '3',
    title: '韩语拟声词的妙用',
    content: '在韩语中，拟声词的使用非常丰富，今天分享一个有趣的例子...',
    tags: ['韩语', '拟声词', '语言特点'],
    author: {
      name: '韩语爱好者',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3'
    },
    likes: 156,
    comments: 45,
    shares: 23,
    bookTitle: '韩语语言学概论',
    imageUrl: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451'
  }
];

export default function CommunityPage() {
  const [shares, setShares] = useState<ContextShare[]>([]);

  useEffect(() => {
    setShares(MOCK_SHARES);
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">语境分享</h1>
        <HoverBorderGradient
          containerClassName="rounded-full"
          className="flex items-center gap-2 text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>分享语境</span>
        </HoverBorderGradient>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shares.map((share) => (
          <Card key={share.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="aspect-video relative overflow-hidden">
              <img
                src={share.imageUrl}
                alt={share.title}
                className="object-cover w-full h-full transform hover:scale-105 transition-transform duration-300"
              />
            </div>
            
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={share.author.avatar}
                  alt={share.author.name}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-sm font-medium">{share.author.name}</span>
              </div>
              <CardTitle className="text-lg">{share.title}</CardTitle>
              <CardDescription className="line-clamp-2">{share.content}</CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {share.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
              
              <div className="flex items-center text-sm text-muted-foreground mb-4">
                <BookOpen className="w-4 h-4 mr-1" />
                <span>来自《{share.bookTitle}》</span>
              </div>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <Button variant="ghost" size="sm" className="gap-1">
                  <ThumbsUp className="w-4 h-4" />
                  <span>{share.likes}</span>
                </Button>
                <Button variant="ghost" size="sm" className="gap-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>{share.comments}</span>
                </Button>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Share2 className="w-4 h-4" />
                  <span>{share.shares}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 