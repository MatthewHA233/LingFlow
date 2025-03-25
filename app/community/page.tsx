import { PlusCircle } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { ShareCard } from '@/components/community/ShareCard';

const MOCK_SHARES = [
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

export default async function CommunityPage() {
  const shares = MOCK_SHARES;

  return (
    <div className="h-full p-2 sm:p-4">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-4 mb-8 px-2 sm:px-4">
          <div>
            <h1 className="text-2xl font-bold">语境分享</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              在这里分享你热爱的语境，将兴趣与情感传达给他人
            </p>
          </div>
          <HoverBorderGradient
            containerClassName="rounded-full flex-shrink-0"
            className="flex items-center gap-2 text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>分享语境</span>
          </HoverBorderGradient>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-2 sm:px-4">
          {shares.map((share) => (
            <ShareCard key={share.id} share={share} />
          ))}
        </div>
      </div>
    </div>
  );
} 