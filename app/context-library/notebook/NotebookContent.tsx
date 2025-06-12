'use client';

import { useEffect, useState, useRef } from 'react';
import { Book, Chapter } from '@/types/book'; // 使用统一的Book和Chapter类型
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase-client';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Plus, BookOpen, MoreHorizontal, Trash, Share, Edit, Calendar, Tag, ChevronRight, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { toast } from 'sonner';
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card';
import NotebookCreateDialog from '@/components/content/NotebookCreateDialog';

export default function NotebookContent() {
  const [notebooks, setNotebooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();

  // 添加引用以跟踪当前活动的菜单
  const activeMenuButtonRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeMenuRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    loadNotebooks();
  }, [user]);

  async function loadNotebooks() {
    if (!user) return;

    try {
      // 从 books 表获取类型为 'notebook' 的记录
      const { data: notebooksData, error: notebooksError } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'notebook')
        .eq('status', 'ready')
        .order('updated_at', { ascending: false });

      if (notebooksError) throw notebooksError;

      // 为每个笔记本获取其章节列表（原来的页面）
      const notebooksWithPages = await Promise.all(
        (notebooksData || []).map(async (notebook) => {
          try {
            const { data: chaptersData, error: chaptersError } = await supabase
              .from('chapters')
              .select(`
                *,
                content_parents!chapters_parent_id_fkey (
                  id,
                  title,
                  content_type
                )
              `)
              .eq('book_id', notebook.id)
              .order('order_index', { ascending: true });

            if (chaptersError) {
              console.error(`获取笔记本 ${notebook.id} 的章节失败:`, chaptersError);
              return { ...notebook, chapters: [] };
            }

            return {
              ...notebook,
              chapters: chaptersData || []
            };
          } catch (error) {
            console.error(`处理笔记本 ${notebook.id} 时出错:`, error);
            return { ...notebook, chapters: [] };
          }
        })
      );

      setNotebooks(notebooksWithPages);
    } catch (error) {
      console.error('加载笔记本失败:', error);
      toast.error('加载笔记本失败');
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteNotebook = async (notebookId: string, title: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 关闭菜单
    setExpandedMenus(prev => ({...prev, [notebookId]: false}));

    const notebook = notebooks.find(n => n.id === notebookId);
    const pageCount = notebook?.note_count || 0;

    confirmAlert({
      title: '确认删除',
      message: `确定要删除笔记本《${title}》吗？其中的 ${pageCount} 个页面也会被删除，此操作不可恢复。`,
      buttons: [
        {
          label: '取消',
          onClick: () => {}
        },
        {
          label: '删除',
          onClick: async () => {
            const toastId = toast.loading(`正在删除《${title}》...`, {
              duration: Infinity,
            });
            
            try {
              // 先将笔记本标记为正在删除状态
              setNotebooks(notebooks.map(notebook => 
                notebook.id === notebookId 
                  ? { ...notebook, isDeleting: true } 
                  : notebook
              ));

              const response = await fetch(`/api/books/delete`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({ bookId: notebookId })
              });

              if (!response.ok) {
                throw new Error('删除失败');
              }

              const data = await response.json();

              toast.success(`《${title}》已删除`, {
                id: toastId,
                duration: 3000,
              });

              // 从列表中移除
              setNotebooks(notebooks.filter(notebook => notebook.id !== notebookId));

            } catch (error) {
              console.error('删除笔记本失败:', error);
              toast.error(`删除《${title}》失败，请重试`, {
                id: toastId,
                duration: 3000,
              });
              
              // 恢复笔记本状态
              setNotebooks(notebooks.map(notebook => 
                notebook.id === notebookId 
                  ? { ...notebook, isDeleting: false }
                  : notebook
              ));
            }
          },
          className: 'react-confirm-alert-button-red'
        }
      ]
    });
  };

  const toggleMenu = (notebookId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setExpandedMenus(prev => {
      const newState = { ...prev };
      
      // 清除所有其他打开的菜单
      Object.keys(newState).forEach(id => {
        if (id !== notebookId) newState[id] = false;
      });
      
      // 切换当前菜单状态
      newState[notebookId] = !prev[notebookId];
      
      return newState;
    });
  };

  const handleMenuItemClick = (notebookId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedMenus(prev => ({...prev, [notebookId]: false}));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleCreateNotebook = () => {
    setShowCreateDialog(true);
  };

  const handleCreateSuccess = () => {
    // 重新加载笔记本列表
    loadNotebooks();
  };

  // 渲染笔记本菜单
  const renderNotebookMenu = (notebook: Book) => (
    <CardItem
      translateZ="70"
      rotateZ="-0.5"
      className="absolute right-1.5 top-7 lg:right-2 lg:top-9 z-30 bg-black border border-white/10 rounded-lg shadow-lg overflow-hidden [transform-style:preserve-3d] w-28 lg:w-36"
      ref={(el: HTMLDivElement | null) => activeMenuRef.current[notebook.id] = el}
    >
      <button 
        onClick={(e) => handleDeleteNotebook(notebook.id, notebook.title, e)}
        className="flex items-center px-3 py-2 lg:px-4 lg:py-2.5 text-xs lg:text-sm text-white w-full hover:bg-red-900/40 transition-colors border-b border-white/10"
      >
        <Trash className="w-3 h-3 lg:w-4 lg:h-4 mr-2" />
        <span>删除</span>
      </button>
      
      <button 
        onClick={(e) => handleMenuItemClick(notebook.id, e)}
        className="flex items-center px-3 py-2 lg:px-4 lg:py-2.5 text-xs lg:text-sm text-white w-full hover:bg-white/10 transition-colors border-b border-white/10"
      >
        <Edit className="w-3 h-3 lg:w-4 lg:h-4 mr-2" />
        <span>编辑信息</span>
      </button>
      
      <button 
        onClick={(e) => handleMenuItemClick(notebook.id, e)}
        className="flex items-center px-3 py-2 lg:px-4 lg:py-2.5 text-xs lg:text-sm text-white w-full hover:bg-white/10 transition-colors"
      >
        <Share className="w-3 h-3 lg:w-4 lg:h-4 mr-2" />
        <span>分享</span>
      </button>
    </CardItem>
  );

  // 渲染单个笔记本卡片
  const renderNotebookCard = (notebook: Book) => {
    // 获取最近更新的3个章节，按更新时间排序
    const recentChapters = notebook.chapters
      ?.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      ?.slice(0, 3) || [];
    
    return (
      <div key={notebook.id} className={`relative transition-all duration-500 ${
        notebook.isDeleting ? 'opacity-50 blur-sm scale-95' : ''
      }`}>
        <CardContainer className="!p-0 !m-0 h-auto" containerClassName="!p-0 !m-0 h-auto !perspective-[1000px]">
          <CardBody className={`relative bg-black border border-white/[0.2] w-full h-auto rounded-lg p-3 group/card hover:shadow-lg hover:shadow-purple-500/[0.1] ${
            notebook.isDeleting ? 'pointer-events-none' : ''
          }`}>
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
                <div className="relative aspect-[4/3] bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-black rounded-lg overflow-hidden border border-purple-500/20 flex items-center justify-center">
                  {notebook.cover_url ? (
                    <Image
                      src={notebook.cover_url}
                      alt={notebook.title}
                      fill
                      className="object-cover group-hover/card:shadow-xl"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-purple-400">
                      <BookOpen className="w-8 h-8 mb-2" />
                      <span className="text-xs opacity-70">笔记本</span>
                    </div>
                  )}
                </div>
              </CardItem>
              
              {/* 最近章节预览 - 只在有章节时显示 */}
              {notebook.note_count > 0 && recentChapters.length > 0 && (
                <CardItem translateZ="30" className="mb-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-400 font-medium">最近页面</div>
                      <div className="text-xs text-purple-400">{notebook.note_count}页</div>
                    </div>
                    <div className="space-y-1.5">
                      {recentChapters.map((chapter, index) => (
                        <div 
                          key={chapter.id}
                          className="group/page bg-gray-900/30 border border-gray-700/50 rounded-md p-2 hover:bg-gray-800/40 hover:border-purple-500/30 transition-all duration-200"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <div className="flex-shrink-0 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 group-hover/page:bg-purple-300 transition-colors"></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-200 truncate font-medium">
                                  {chapter.title}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  {formatDate(chapter.updated_at)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {notebook.note_count > 3 && (
                        <div className="text-center">
                          <div className="text-xs text-gray-500 bg-gray-900/40 border border-gray-700/30 rounded-md py-1.5 px-2">
                            还有 {notebook.note_count - 3} 个页面...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardItem>
              )}
              
              <div className="flex flex-col mt-auto space-y-2">
                {/* 统计信息 */}
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <div className="flex items-center">
                    <Tag className="w-3 h-3 mr-1" />
                    <span>{notebook.note_count} 页面</span>
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
                  as={Link}
                  href={`/reader/${notebook.id}`}
                  className="w-full px-3 py-2 rounded-md bg-gradient-to-tr from-purple-600 to-purple-500 text-white text-xs font-bold flex items-center justify-center hover:shadow-sm hover:shadow-purple-500/20 transition-all"
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
              ref={(el: HTMLButtonElement | null) => activeMenuButtonRef.current[notebook.id] = el}
            >
              <MoreHorizontal className="w-4 h-4" />
            </CardItem>
            
            {expandedMenus[notebook.id] && renderNotebookMenu(notebook)}
          </CardBody>
        </CardContainer>
      </div>
    );
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
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500/70 via-purple-400 to-transparent"></div>
                </h1>
                <div className="ml-3 px-2 py-0.5 rounded-full text-[10px] border border-purple-500/30 text-purple-400 bg-purple-950/30">
                  {notebooks.length} 个笔记本
                </div>
              </div>
              
              <HoverBorderGradient
                containerClassName="rounded-full flex-shrink-0"
                className="flex items-center gap-2 text-sm"
                as="button"
                onClick={handleCreateNotebook}
              >
                <Plus className="w-4 h-4" />
                <span>新建笔记本</span>
              </HoverBorderGradient>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 px-1 sm:px-2 md:px-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="relative">
                    <div className="bg-black border border-white/[0.2] rounded-lg p-3 h-auto overflow-hidden">
                      <Skeleton className="h-4 w-4/5 mb-2 bg-gray-800" />
                      <Skeleton className="h-3 w-full mb-3 bg-gray-800" />
                      <Skeleton className="w-full aspect-[4/3] rounded-lg mb-3 bg-gray-800" />
                      <div className="space-y-1 mb-3">
                        <Skeleton className="h-2 w-16 bg-gray-800" />
                        <Skeleton className="h-3 w-full bg-gray-800" />
                        <Skeleton className="h-3 w-3/4 bg-gray-800" />
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <Skeleton className="h-3 w-16 bg-gray-800" />
                        <Skeleton className="h-3 w-20 bg-gray-800" />
                      </div>
                      <Skeleton className="h-8 w-full rounded-md bg-gray-800" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shine rounded-lg" />
                  </div>
                ))}
              </div>
            ) : notebooks.length === 0 ? (
              <div className="text-center py-12 px-2 sm:px-4">
                <h2 className="text-xl font-semibold mb-2">还没有笔记本</h2>
                <p className="text-muted-foreground mb-4">创建您的第一个笔记本开始自定义语境</p>
                <HoverBorderGradient
                  containerClassName="rounded-full mx-auto"
                  className="flex items-center gap-2"
                  as="button"
                  onClick={handleCreateNotebook}
                >
                  <Plus className="w-4 h-4" />
                  <span>创建笔记本</span>
                </HoverBorderGradient>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 px-1 sm:px-2 md:px-4">
                {notebooks.map(renderNotebookCard)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 创建笔记本对话框 */}
      <NotebookCreateDialog
        isOpen={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}