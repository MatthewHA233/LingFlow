'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';

export default function AnchorDomain() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">锚点域</h1>
        <HoverBorderGradient
          containerClassName="rounded-full"
          className="flex items-center gap-2 text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>创建锚点</span>
        </HoverBorderGradient>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 示例锚点卡片 */}
        <Card className="p-6 hover:border-primary transition-colors">
          <h3 className="text-lg font-semibold mb-2">英语语法锚点</h3>
          <p className="text-sm text-muted-foreground mb-4">
            包含常用语法结构和用法示例
          </p>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>32 个知识点</span>
            <span>最近更新: 2024-02-19</span>
          </div>
        </Card>

        <Card className="p-6 hover:border-primary transition-colors">
          <h3 className="text-lg font-semibold mb-2">日语词根锚点</h3>
          <p className="text-sm text-muted-foreground mb-4">
            常见词根及其衍生词汇整理
          </p>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>48 个知识点</span>
            <span>最近更新: 2024-02-18</span>
          </div>
        </Card>

        <Card className="p-6 hover:border-primary transition-colors">
          <h3 className="text-lg font-semibold mb-2">发音规则锚点</h3>
          <p className="text-sm text-muted-foreground mb-4">
            英语音标和发音规则总结
          </p>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>25 个知识点</span>
            <span>最近更新: 2024-02-17</span>
          </div>
        </Card>
      </div>
    </div>
  );
} 