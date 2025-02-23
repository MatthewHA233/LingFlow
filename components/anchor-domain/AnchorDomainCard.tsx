'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, Lightbulb } from 'lucide-react';
import { AnchorCloud } from './AnchorCloud';
import type { TimeDomain, SpaceDomain } from '@/types/anchor';

interface AnchorDomainCardProps {
  domain: TimeDomain | SpaceDomain;
  type: 'time' | 'space';
}

export function AnchorDomainCard({ domain, type }: AnchorDomainCardProps) {
  const isTimeDomain = type === 'time';
  
  if (isTimeDomain) {
    return (
      <div className="w-full h-full bg-background/50">
        <AnchorCloud days={(domain as TimeDomain).days} />
      </div>
    );
  }

  const spaceDomain = domain as SpaceDomain;
  
  return (
    <Card className="p-6 hover:border-primary transition-colors group cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
            {spaceDomain.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {spaceDomain.description}
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {spaceDomain.type}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            <span>{domain.totalAnchors} 锚点</span>
          </div>
          <div className="flex items-center gap-1">
            <Lightbulb className="w-4 h-4" />
            <span>{domain.meaningBlocks} 含义块</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {spaceDomain.anchors.map(anchor => (
            <span key={anchor.word} className="px-2 py-1 bg-muted rounded-full text-sm">
              {anchor.word}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
} 