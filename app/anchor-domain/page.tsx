import { AnchorDomainCard } from '@/components/anchor-domain/AnchorDomainCard';
import { PlusCircle, Clock, Shapes } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TIME_DOMAINS = [
  {
    id: '1',
    month: '2024-02',
    days: [
      {
        date: '2024-02-20',
        anchors: [
          {
            word: 'meticulous',
            meaningBlocks: [
              {
                id: '4',
                meaning: '一丝不苟的，极其细心的',
                contexts: [
                  {
                    text: 'She is meticulous in her research',
                    source: '《Academic Writing》',
                    date: '2024-02-20'
                  }
                ],
                reviewCount: 1,
                nextReviewDate: '2024-02-23',
                proficiency: 30
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-20'
          }
        ]
      },
      {
        date: '2024-02-19',
        anchors: [
          {
            word: 'carry oneself',
            meaningBlocks: [
              {
                id: '1',
                meaning: '举止，表现',
                contexts: [
                  {
                    text: 'The way she carries herself suggests confidence',
                    source: '《The Power of Body Language》',
                    date: '2024-02-19'
                  }
                ],
                reviewCount: 1,
                nextReviewDate: '2024-02-22',
                proficiency: 40
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-19'
          },
          {
            word: 'eloquent',
            meaningBlocks: [
              {
                id: '2',
                meaning: '雄辩的，有说服力的',
                contexts: [
                  {
                    text: 'His speech was both eloquent and persuasive',
                    source: '《The Art of Public Speaking》',
                    date: '2024-02-19'
                  }
                ],
                reviewCount: 1,
                nextReviewDate: '2024-02-22',
                proficiency: 60
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-19'
          },
          {
            word: 'resilient',
            meaningBlocks: [
              {
                id: '9',
                meaning: '有适应力的，能快速恢复的',
                contexts: [
                  {
                    text: 'Children are remarkably resilient in the face of challenges',
                    source: '《Psychology Today》',
                    date: '2024-02-19'
                  }
                ],
                reviewCount: 1,
                nextReviewDate: '2024-02-22',
                proficiency: 45
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-19'
          },
          {
            word: 'pragmatic',
            meaningBlocks: [
              {
                id: '10',
                meaning: '务实的，实用的',
                contexts: [
                  {
                    text: 'We need a pragmatic approach to solve this problem',
                    source: '《Business Strategy》',
                    date: '2024-02-19'
                  }
                ],
                reviewCount: 1,
                nextReviewDate: '2024-02-22',
                proficiency: 50
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-19'
          },
          {
            word: 'intricate',
            meaningBlocks: [
              {
                id: '11',
                meaning: '复杂的，精细的',
                contexts: [
                  {
                    text: 'The watch mechanism is incredibly intricate',
                    source: '《Engineering Weekly》',
                    date: '2024-02-19'
                  }
                ],
                reviewCount: 1,
                nextReviewDate: '2024-02-22',
                proficiency: 35
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-19'
          }
        ]
      },
      {
        date: '2024-02-18',
        anchors: [
          {
            word: 'profound',
            meaningBlocks: [
              {
                id: '3',
                meaning: '深刻的，意义深远的',
                contexts: [
                  {
                    text: 'The book had a profound impact on my thinking',
                    source: '《Reading Notes》',
                    date: '2024-02-18'
                  }
                ],
                reviewCount: 2,
                nextReviewDate: '2024-02-21',
                proficiency: 80
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-18'
          }
        ]
      },
      {
        date: '2024-02-17',
        anchors: [
          {
            word: 'ephemeral',
            meaningBlocks: [
              {
                id: '5',
                meaning: '短暂的，瞬息即逝的',
                contexts: [
                  {
                    text: 'Beauty is ephemeral',
                    source: '《Philosophy Notes》',
                    date: '2024-02-17'
                  }
                ],
                reviewCount: 3,
                nextReviewDate: '2024-02-22',
                proficiency: 85
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-17'
          },
          {
            word: 'tenacious',
            meaningBlocks: [
              {
                id: '12',
                meaning: '坚韧的，顽强的',
                contexts: [
                  {
                    text: 'Her tenacious pursuit of justice inspired many',
                    source: '《Leadership Stories》',
                    date: '2024-02-17'
                  }
                ],
                reviewCount: 2,
                nextReviewDate: '2024-02-20',
                proficiency: 65
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-17'
          },
          {
            word: 'enigmatic',
            meaningBlocks: [
              {
                id: '13',
                meaning: '神秘的，难以理解的',
                contexts: [
                  {
                    text: 'The enigmatic smile of the Mona Lisa',
                    source: '《Art History》',
                    date: '2024-02-17'
                  }
                ],
                reviewCount: 2,
                nextReviewDate: '2024-02-20',
                proficiency: 55
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-17'
          },
          {
            word: 'impeccable',
            meaningBlocks: [
              {
                id: '14',
                meaning: '完美的，无瑕疵的',
                contexts: [
                  {
                    text: 'His impeccable manners impressed everyone at the dinner',
                    source: '《Social Etiquette》',
                    date: '2024-02-17'
                  }
                ],
                reviewCount: 2,
                nextReviewDate: '2024-02-20',
                proficiency: 70
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-17'
          }
        ]
      },
      {
        date: '2024-02-16',
        anchors: [
          {
            word: 'ubiquitous',
            meaningBlocks: [
              {
                id: '6',
                meaning: '无处不在的',
                contexts: [
                  {
                    text: 'Smartphones have become ubiquitous',
                    source: '《Modern Technology》',
                    date: '2024-02-16'
                  }
                ],
                reviewCount: 4,
                nextReviewDate: '2024-02-23',
                proficiency: 75
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-16'
          }
        ]
      },
      {
        date: '2024-02-15',
        anchors: [
          {
            word: 'serendipity',
            meaningBlocks: [
              {
                id: '7',
                meaning: '意外发现美好事物的能力',
                contexts: [
                  {
                    text: 'Finding this cafe was pure serendipity',
                    source: '《Daily Journal》',
                    date: '2024-02-15'
                  }
                ],
                reviewCount: 2,
                nextReviewDate: '2024-02-22',
                proficiency: 55
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-15'
          }
        ]
      },
      {
        date: '2024-02-14',
        anchors: [
          {
            word: 'quintessential',
            meaningBlocks: [
              {
                id: '8',
                meaning: '典型的，最具代表性的',
                contexts: [
                  {
                    text: 'This is the quintessential example of modern architecture',
                    source: '《Architecture Review》',
                    date: '2024-02-14'
                  }
                ],
                reviewCount: 3,
                nextReviewDate: '2024-02-21',
                proficiency: 70
              }
            ],
            totalContexts: 1,
            lastUpdated: '2024-02-14'
          }
        ]
      }
    ],
    totalAnchors: 12,
    meaningBlocks: 14
  }
];

const SPACE_DOMAINS = [
  {
    id: '1',
    title: '表达"看"的动词辨析',
    description: 'look, watch, see, observe, gaze...',
    type: 'synonym' as const,
    anchors: [
      {
        word: 'look',
        meaningBlocks: [
          {
            id: '1',
            meaning: '主动看，寻找',
            contexts: [
              {
                text: 'Look at the sky',
                source: '《English Verbs》',
                date: '2024-02-15'
              },
              {
                text: 'Look for your keys',
                source: '《Daily English》',
                date: '2024-02-16'
              }
            ],
            reviewCount: 2,
            nextReviewDate: '2024-02-20',
            proficiency: 65
          }
        ],
        totalContexts: 2,
        lastUpdated: '2024-02-16'
      },
      {
        word: 'watch',
        meaningBlocks: [
          {
            id: '2',
            meaning: '持续观看，关注',
            contexts: [
              {
                text: 'Watch a movie',
                source: '《English Verbs》',
                date: '2024-02-15'
              },
              {
                text: 'Watch the kids',
                source: '《Daily English》',
                date: '2024-02-16'
              }
            ],
            reviewCount: 2,
            nextReviewDate: '2024-02-20',
            proficiency: 65
          }
        ],
        totalContexts: 2,
        lastUpdated: '2024-02-16'
      }
    ],
    totalAnchors: 8,
    meaningBlocks: 12
  },
  {
    id: '2',
    title: 'affect/effect 形近词辨析',
    description: '常见易混淆词对',
    type: 'similar' as const,
    anchors: [
      {
        word: 'affect',
        meaningBlocks: [
          {
            id: '1',
            meaning: '影响(动词)',
            contexts: [
              {
                text: 'The weather affects my mood',
                source: '《Common Confusing Words》',
                date: '2024-02-18'
              }
            ],
            reviewCount: 1,
            nextReviewDate: '2024-02-21',
            proficiency: 65
          }
        ],
        totalContexts: 1,
        lastUpdated: '2024-02-18'
      },
      {
        word: 'effect',
        meaningBlocks: [
          {
            id: '2',
            meaning: '效果(名词)',
            contexts: [
              {
                text: 'The effect was immediate',
                source: '《Common Confusing Words》',
                date: '2024-02-18'
              }
            ],
            reviewCount: 1,
            nextReviewDate: '2024-02-21',
            proficiency: 65
          },
          {
            id: '3',
            meaning: '实现(动词)',
            contexts: [
              {
                text: 'to effect change',
                source: '《Advanced English Usage》',
                date: '2024-02-18'
              }
            ],
            reviewCount: 1,
            nextReviewDate: '2024-02-21',
            proficiency: 65
          }
        ],
        totalContexts: 2,
        lastUpdated: '2024-02-18'
      }
    ],
    totalAnchors: 2,
    meaningBlocks: 4
  },
  {
    id: '3',
    title: '描述性形容词集合',
    description: 'beautiful, gorgeous, stunning, magnificent...',
    type: 'synonym' as const,
    anchors: [
      {
        word: 'beautiful',
        meaningBlocks: [
          {
            id: '1',
            meaning: '美丽的，普遍用法',
            contexts: [
              {
                text: 'A beautiful sunset over the ocean',
                source: '《Descriptive Writing》',
                date: '2024-02-19'
              }
            ],
            reviewCount: 1,
            nextReviewDate: '2024-02-22',
            proficiency: 90
          }
        ],
        totalContexts: 1,
        lastUpdated: '2024-02-19'
      },
      {
        word: 'gorgeous',
        meaningBlocks: [
          {
            id: '2',
            meaning: '华丽的，令人印象深刻的美',
            contexts: [
              {
                text: 'She wore a gorgeous evening gown',
                source: '《Fashion Magazine》',
                date: '2024-02-19'
              }
            ],
            reviewCount: 1,
            nextReviewDate: '2024-02-22',
            proficiency: 75
          }
        ],
        totalContexts: 1,
        lastUpdated: '2024-02-19'
      }
    ],
    totalAnchors: 2,
    meaningBlocks: 2
  },
  {
    id: '4',
    title: '商务英语常用词组',
    description: 'implement, execute, carry out...',
    type: 'synonym' as const,
    anchors: [
      {
        word: 'implement',
        meaningBlocks: [
          {
            id: '1',
            meaning: '实施，执行（正式）',
            contexts: [
              {
                text: 'We need to implement this strategy by next quarter',
                source: '《Business English》',
                date: '2024-02-20'
              }
            ],
            reviewCount: 1,
            nextReviewDate: '2024-02-23',
            proficiency: 65
          }
        ],
        totalContexts: 1,
        lastUpdated: '2024-02-20'
      }
    ],
    totalAnchors: 1,
    meaningBlocks: 1
  }
];

export default async function AnchorDomainPage() {
  console.log('TIME_DOMAINS:', JSON.stringify(TIME_DOMAINS, null, 2));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-4">
          <div>
        <h1 className="text-2xl font-bold">锚点域</h1>
            <p className="text-sm text-muted-foreground mt-2">
              在这里探索你的词锚点网络，见证语言知识的时空交织
            </p>
          </div>
        <HoverBorderGradient
          containerClassName="rounded-full"
          className="flex items-center gap-2 text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>创建锚点</span>
        </HoverBorderGradient>
      </div>

        <Tabs defaultValue="time" className="h-[calc(100vh-8rem)]">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
            <TabsTrigger value="time" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              时间锚点域
            </TabsTrigger>
            <TabsTrigger value="space" className="flex items-center gap-2">
              <Shapes className="w-4 h-4" />
              空间锚点域
            </TabsTrigger>
          </TabsList>

          <TabsContent value="time" className="h-full">
            {TIME_DOMAINS.map(domain => (
              <AnchorDomainCard key={domain.id} domain={domain} type="time" />
            ))}
          </TabsContent>

          <TabsContent value="space">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SPACE_DOMAINS.map(domain => (
                <AnchorDomainCard key={domain.id} domain={domain} type="space" />
              ))}
          </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 