'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, ThumbsUp, Share2, BookOpen } from 'lucide-react';

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

export function ShareCard({ share }: { share: ContextShare }) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
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
  );
} 