'use client';

import { useState } from 'react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Plus, BookOpen, MoreHorizontal, Calendar, Tag, ChevronRight } from 'lucide-react';
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card';

// 硬编码的笔记本数据
const mockNotebooks = [
  {
    id: '1',
    title: '学习笔记',
    description: '记录日常学习的重要知识点和心得体会',
    note_count: 15,
    updated_at: '2024-01-15T10:30:00Z',
    cover_url: null
  },
  {
    id: '2', 
    title: '工作日志',
    description: '项目进度、会议记录和工作心得',
    note_count: 8,
    updated_at: '2024-01-14T16:45:00Z',
    cover_url: null
  },
  {
    id: '3',
    title: '读书笔记',
    description: '阅读各类书籍的摘录和感悟',
    note_count: 23,
    updated_at: '2024-01-13T09:20:00Z',
    cover_url: null
  },
  {
    id: '4',
    title: '灵感收集',
    description: '随时记录的创意想法和灵感片段',
    note_count: 7,
    updated_at: '2024-01-12T14:15:00Z',
    cover_url: null
  }
];

export default function NotebookContent() {
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const toggleMenu = (notebookId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setExpandedMenus(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(id => {
        if (id !== notebookId) newState[id] = false;
      });
      newState[notebookId] = !prev[notebookId];
      return newState;
    });
  };

  return (
    <div className="relative overflow-hidden rounded-xl p-[1px] mx-2 sm:mx-6 md:mx-8 lg:mx-12 xl:mx-16">
      <span className="absolute inset-0 bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
      <div className="relative bg-black/80 backdrop-blur-md rounded-xl p-0">
        <div className="h-full p-1 sm:p-2 md:p-4">
          <div className="container mx-auto px-2 sm:px-4 md:px-6">
            {/* 页面标题和新建按钮 */}
            <div className="flex items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6 px-1 sm:px-2 md:px-4">
              <div className="flex items-center">
                <h1 className="relative text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-300 pb-0.5">
                  我的笔记
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500/70 via-emerald-400 to-transparent"></div>
                </h1>
                <div className="ml-3 px-2 py-0.5 rounded-full text-[10px] border border-emerald-500/30 text-emerald-400 bg-emerald-950/30">
                  {mockNotebooks.length} 个笔记本
                </div>
              </div>
              
              <HoverBorderGradient
                containerClassName="rounded-full flex-shrink-0"
                className="flex items-center gap-2 text-sm"
                as="button"
              >
                <Plus className="w-4 h-4" />
                <span>新建笔记本</span>
              </HoverBorderGradient>
            </div>

            {/* 笔记本网格 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 px-1 sm:px-2 md:px-4">
              {mockNotebooks.map((notebook) => (
                <div key={notebook.id} className="relative">
                  <CardContainer className="!p-0 !m-0 h-auto" containerClassName="!p-0 !m-0 h-auto !perspective-[1000px]">
                    <CardBody className="relative bg-black border border-white/[0.2] w-full h-auto rounded-lg p-3 group/card hover:shadow-lg hover:shadow-emerald-500/[0.1]">
                      <div className="flex flex-col h-full">
                        <CardItem
                          translateZ="35"
                          rotateX="-2"
                          className="text-sm lg:text-base font-bold text-white mb-1 truncate text-shadow-sm"
                        >
                          {notebook.title}
                        </CardItem>
                        
                        {notebook.description && (
                          <CardItem
                            as="p"
                            translateZ="40"
                            rotateX="-1"
                            rotateY="0.5"
                            className="text-neutral-300 text-[10px] lg:text-xs mb-3 line-clamp-2"
                          >
                            {notebook.description}
                          </CardItem>
                        )}
                        
                        <CardItem 
                          translateZ="45" 
                          rotateY="1.5"
                          className="w-full mb-3"
                        >
                          <div className="relative aspect-[4/3] bg-gradient-to-br from-emerald-900/20 via-emerald-800/10 to-black rounded-lg overflow-hidden border border-emerald-500/20 flex items-center justify-center">
                            <div className="flex flex-col items-center justify-center text-emerald-400">
                              <BookOpen className="w-8 h-8 mb-2" />
                              <span className="text-xs opacity-70">笔记本</span>
                            </div>
                          </div>
                        </CardItem>
                        
                        <div className="flex flex-col mt-auto space-y-2">
                          {/* 统计信息 */}
                          <div className="flex justify-between items-center text-xs text-gray-400">
                            <div className="flex items-center">
                              <Tag className="w-3 h-3 mr-1" />
                              <span>{notebook.note_count} 笔记</span>
                            </div>
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              <span>{formatDate(notebook.updated_at)}</span>
                            </div>
                          </div>
                          
                          {/* 打开按钮 */}
                          <CardItem
                            translateZ={35}
                            rotateY="0.8"
                            className="w-full px-3 py-2 rounded-md bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white text-xs font-bold flex items-center justify-center hover:shadow-sm hover:shadow-emerald-500/20 transition-all cursor-pointer"
                          >
                            打开笔记本 <ChevronRight className="w-3 h-3 ml-1" />
                          </CardItem>
                        </div>
                      </div>
                      
                      <CardItem
                        as="button"
                        translateZ="50"
                        rotateZ="1"
                        onClick={(e: React.MouseEvent) => toggleMenu(notebook.id, e)}
                        className="absolute right-1.5 top-1.5 lg:right-2 lg:top-2 z-20 p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white transition-all hover:bg-black/60"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </CardItem>
                      
                      {expandedMenus[notebook.id] && (
                        <CardItem
                          translateZ="70"
                          rotateZ="-0.5"
                          className="absolute right-1.5 top-7 lg:right-2 lg:top-9 z-30 bg-black border border-white/10 rounded-lg shadow-lg overflow-hidden [transform-style:preserve-3d] w-28 lg:w-36"
                        >
                          <button className="flex items-center px-3 py-2 lg:px-4 lg:py-2.5 text-xs lg:text-sm text-white w-full hover:bg-white/10 transition-colors border-b border-white/10">
                            <span>编辑信息</span>
                          </button>
                          <button className="flex items-center px-3 py-2 lg:px-4 lg:py-2.5 text-xs lg:text-sm text-white w-full hover:bg-white/10 transition-colors border-b border-white/10">
                            <span>分享</span>
                          </button>
                          <button className="flex items-center px-3 py-2 lg:px-4 lg:py-2.5 text-xs lg:text-sm text-white w-full hover:bg-red-900/40 transition-colors">
                            <span>删除</span>
                          </button>
                        </CardItem>
                      )}
                    </CardBody>
                  </CardContainer>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 