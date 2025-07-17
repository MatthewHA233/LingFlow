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
import { Plus, BookOpen, MoreHorizontal, Trash, Share, Edit, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { toast } from 'sonner';
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card';
import NotebookCreateDialog from '@/components/content/NotebookCreateDialog';
import NotebookEditDialog from '@/components/content/NotebookEditDialog';

// 页面级别的内存缓存
let pageCache: {
  userId: string | null;
  notebooks: Book[];
  timestamp: number;
} = {
  userId: null,
  notebooks: [],
  timestamp: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

export default function NotebookContent() {
  const [notebooks, setNotebooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [placeholderStates, setPlaceholderStates] = useState<Record<string, boolean>>({});
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Book | null>(null);
  const [notebookResources, setNotebookResources] = useState<Array<any>>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [savingNotebook, setSavingNotebook] = useState(false);
  const [editingNotebookIds, setEditingNotebookIds] = useState<Record<string, boolean>>({});
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

    // 检查缓存
    const now = Date.now();
    const isCacheValid = pageCache.userId === user.id && 
                        pageCache.notebooks.length > 0 && 
                        (now - pageCache.timestamp) < CACHE_DURATION;

    if (isCacheValid) {
      console.log('使用缓存的笔记本数据');
      setNotebooks(pageCache.notebooks);
      setLoading(false);
      return;
    }

    console.log('重新加载笔记本数据');

    try {
      // 从 books 表获取类型为 'notebook' 的记录
      const { data: notebooksData, error: notebooksError } = await supabase
        .from('books')
        .select(`
          *,
          chapters (*, order_index)
        `)
        .eq('user_id', user.id)
        .eq('type', 'notebook')
        .eq('status', 'ready')
        .order('updated_at', { ascending: false });

      if (notebooksError) throw notebooksError;

      // 确保章节按顺序排列并添加统计信息
      const notebooksWithStats = (notebooksData || []).map(notebook => ({
        ...notebook,
        chapters: notebook.chapters?.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index) || [],
        stats: {
          chapter_count: notebook.chapters?.length || 0,
          text_block_count: 0,
          audio_block_count: 0,
          image_block_count: 0,
          total_block_count: 0
        }
      }));

      // 尝试获取统计数据
      try {
        const notebookIds = notebooksWithStats.map(notebook => notebook.id);
        if (notebookIds.length > 0) {
          const { data: statsData } = await supabase
            .from('book_statistics')
            .select('book_id, chapter_count, text_block_count, audio_block_count, image_block_count, total_block_count')
            .in('book_id', notebookIds);

          if (statsData && statsData.length > 0) {
            const statsMap = statsData.reduce((acc, stat) => {
              acc[stat.book_id] = stat;
              return acc;
            }, {} as Record<string, any>);

            notebooksWithStats.forEach(notebook => {
              if (statsMap[notebook.id]) {
                notebook.stats = {
                  chapter_count: statsMap[notebook.id].chapter_count || notebook.chapters?.length || 0,
                  text_block_count: statsMap[notebook.id].text_block_count || 0,
                  audio_block_count: statsMap[notebook.id].audio_block_count || 0,
                  image_block_count: statsMap[notebook.id].image_block_count || 0,
                  total_block_count: statsMap[notebook.id].total_block_count || 0
                };
              }
            });
          }
        }
      } catch (statsError) {
        console.warn('获取统计数据失败，使用默认值:', statsError);
      }

      setNotebooks(notebooksWithStats);
      
      // 更新缓存
      pageCache = {
        userId: user.id,
        notebooks: notebooksWithStats,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('加载笔记本失败:', error);
      toast.error('加载笔记本失败');
    } finally {
      setLoading(false);
    }
  }

  // 加载笔记本资源
  async function loadNotebookResources(notebookId: string) {
    setResourcesLoading(true);
    try {
      const { data: resources, error } = await supabase
        .from('book_resources')
        .select('*')
        .eq('book_id', notebookId)
        .eq('resource_type', 'image')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotebookResources(resources || []);
    } catch (error) {
      console.error('加载资源失败:', error);
      toast.error('加载资源失败');
      setNotebookResources([]);
    } finally {
      setResourcesLoading(false);
    }
  }

  // 处理编辑按钮点击
  const handleEditNotebook = async (notebook: Book, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 关闭菜单
    setExpandedMenus(prev => ({...prev, [notebook.id]: false}));
    
    // 关闭任何已经打开的编辑对话框
    setShowEditDialog(false);
    
    // 清除之前的编辑笔记本和资源
    setEditingNotebook(null);
    setNotebookResources([]);
    
    // 设置编辑加载状态
    setEditingNotebookIds(prev => ({...prev, [notebook.id]: true}));
    
    try {
      // 设置正在编辑的笔记本
      setEditingNotebook(notebook);
      
      // 加载笔记本资源
      await loadNotebookResources(notebook.id);
      
      // 显示编辑对话框
      setShowEditDialog(true);
    } catch (error) {
      console.error('准备编辑笔记本时出错:', error);
      toast.error('加载编辑信息失败');
    } finally {
      // 无论成功失败，都清除加载状态
      setEditingNotebookIds(prev => ({...prev, [notebook.id]: false}));
    }
  };

  // 保存笔记本信息
  const saveNotebookInfo = async (values: any) => {
    if (!editingNotebook) return;
    
    try {
      setSavingNotebook(true);
      
      const response = await fetch(`/api/notebooks/update-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          notebookId: editingNotebook.id,
          title: values.title,
          description: values.description,
          cover_url: values.cover_url,
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新笔记本信息失败');
      }
      
      const data = await response.json();
      
      // 更新本地笔记本数据
      const updatedNotebooks = notebooks.map(notebook => 
        notebook.id === editingNotebook.id
          ? {
              ...notebook,
              title: values.title,
              description: values.description || notebook.description,
              cover_url: values.cover_url || notebook.cover_url,
              updated_at: data.notebook.updated_at
            }
          : notebook
      );
      
      setNotebooks(updatedNotebooks);
      
      // 更新缓存
      pageCache = {
        userId: user?.id || null,
        notebooks: updatedNotebooks,
        timestamp: Date.now()
      };
      
      toast.success('笔记本信息已更新');
      setShowEditDialog(false);
    } catch (error: any) {
      console.error('更新笔记本信息失败:', error);
      toast.error(error.message || '更新笔记本信息失败');
    } finally {
      setSavingNotebook(false);
    }
  };

  // 处理编辑对话框关闭
  const handleEditDialogChange = (open: boolean) => {
    if (!open) {
      // 如果对话框正在关闭，清理状态
      setTimeout(() => {
        setEditingNotebook(null);
        setNotebookResources([]);
      }, 300); // 等待对话框关闭动画完成
    }
    setShowEditDialog(open);
  };

  // 格式化数字显示
  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

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
              const updatedNotebooks = notebooks.map(notebook => 
                notebook.id === notebookId 
                  ? { ...notebook, isDeleting: true } 
                  : notebook
              );
              setNotebooks(updatedNotebooks);

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
              const finalNotebooks = notebooks.filter(notebook => notebook.id !== notebookId);
              setNotebooks(finalNotebooks);
              
              // 更新缓存
              pageCache = {
                userId: user?.id || null,
                notebooks: finalNotebooks,
                timestamp: Date.now()
              };

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

  const handleCreateNotebook = () => {
    setShowCreateDialog(true);
  };

  const handleCreateSuccess = () => {
    // 清除缓存并重新加载笔记本列表
    pageCache = {
      userId: null,
      notebooks: [],
      timestamp: 0
    };
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
        onClick={(e) => handleEditNotebook(notebook, e)}
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-3 px-2 sm:px-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="relative">
                    <div className="bg-black border border-white/[0.2] rounded-lg lg:p-3 p-2 h-auto overflow-hidden">
                      <Skeleton className="h-4 w-4/5 mb-0.5 bg-gray-800" />
                      <Skeleton className="h-3 w-full mb-1.5 bg-gray-800" />
                      <Skeleton className="w-full aspect-[3/2.2] lg:aspect-[3/2] rounded-lg mb-2 bg-gray-800" />
                      <div className="grid grid-cols-5 gap-0.5 mb-1">
                        {[...Array(5)].map((_, j) => (
                          <Skeleton key={j} className="h-8 bg-gray-800" />
                        ))}
                      </div>
                      <Skeleton className="h-6 w-full rounded-md bg-gray-800" />
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-3 px-2 sm:px-4">
                {notebooks.map((notebook) => (
                  <div key={notebook.id} className={`relative transition-all duration-500 ${
                    notebook.isDeleting ? 'opacity-50 blur-sm scale-95' : ''
                  }`}>
                    <CardContainer className="!p-0 !m-0 h-auto" containerClassName="!p-0 !m-0 h-auto !perspective-[1000px]">
                      <CardBody className={`relative bg-black border border-white/[0.2] w-full h-auto rounded-lg lg:p-3 p-2 group/card hover:shadow-lg hover:shadow-purple-500/[0.1] ${
                        notebook.isDeleting ? 'pointer-events-none' : ''
                      }`}>
                        <div className="flex flex-col h-full">
                          <CardItem
                            translateZ="35"
                            rotateX="-2"
                            className="text-sm lg:text-base font-bold text-white mb-0.5 truncate text-shadow-sm"
                          >
                            {notebook.title}
                          </CardItem>
                          
                          <CardItem
                            as="p"
                            translateZ="40"
                            rotateX="-1"
                            rotateY="0.5"
                            className="text-neutral-300 text-[10px] lg:text-xs mb-1.5 truncate"
                          >
                            {notebook.description || "自定义笔记本"}
                          </CardItem>
                          
                          <CardItem 
                            translateZ="45" 
                            rotateY="1.5"
                            className="w-full mb-2"
                          >
                            <div className="relative aspect-[3/2.2] lg:aspect-[3/2] bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-black rounded-lg overflow-hidden border border-purple-500/20 flex items-center justify-center">
                              {notebook.cover_url ? (
                                <Image
                                  src={notebook.cover_url}
                                  alt={notebook.title}
                                  fill
                                  className="object-cover group-hover/card:shadow-xl"
                                  onError={(e) => {
                                    try {
                                      const img = e.target as HTMLImageElement;
                                      img.style.display = 'none';
                                      setPlaceholderStates(prev => ({...prev, [notebook.id]: true}));
                                    } catch (error) {
                                      console.error('处理封面失败:', error);
                                      setPlaceholderStates(prev => ({...prev, [notebook.id]: true}));
                                    }
                                  }}
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-purple-400">
                                  <BookOpen className="w-8 h-8 mb-2" />
                                  <span className="text-xs opacity-70">笔记本</span>
                                </div>
                              )}
                              
                              {placeholderStates[notebook.id] && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-black text-purple-400">
                                  <BookOpen className="w-8 h-8 mb-2" />
                                  <span className="text-xs opacity-70">笔记本</span>
                                </div>
                              )}
                            </div>
                          </CardItem>
                          
                          <div className="flex flex-col mt-auto space-y-1">
                            {/* 统计数据 - 突出显示页面和语境块 */}
                            <div className="grid grid-cols-5 w-full gap-0.5 mb-1">
                              {/* 页面 - 高亮显示 */}
                              <CardItem
                                translateZ={25}
                                className="text-[8px] lg:text-[11px] text-center"
                              >
                                <div className="flex flex-col">
                                  <span className="font-bold text-white">{notebook.chapters?.length || 0}</span>
                                  <span className="text-purple-400">页面</span>
                                </div>
                              </CardItem>
                              
                              {/* 语境块 - 高亮显示 */}
                              <CardItem
                                translateZ={25}
                                className="text-[8px] lg:text-[11px] text-center"
                              >
                                <div className="flex flex-col">
                                  <span className="font-bold text-white">{formatNumber(notebook.stats?.total_block_count || 0)}</span>
                                  <span className="text-purple-400">语境块</span>
                                </div>
                              </CardItem>
                              
                              {/* 其他三个项目保持稍暗状态 */}
                              <CardItem
                                translateZ={15}
                                className="text-[8px] lg:text-[11px] text-center opacity-70"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{formatNumber(notebook.stats?.text_block_count || 0)}</span>
                                  <span className="text-gray-400">文本块</span>
                                </div>
                              </CardItem>
                              
                              <CardItem
                                translateZ={15}
                                className="text-[8px] lg:text-[11px] text-center opacity-70"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{formatNumber(notebook.stats?.image_block_count || 0)}</span>
                                  <span className="text-gray-400">图片块</span>
                                </div>
                              </CardItem>

                              {/* 点读块 - 当数量大于0时使用橙色强调 */}
                              <CardItem
                                translateZ={15}
                                className={`text-[8px] lg:text-[11px] text-center ${
                                  (notebook.stats?.audio_block_count || 0) > 0 
                                    ? 'opacity-100' 
                                    : 'opacity-70'
                                }`}
                              >
                                <div className="flex flex-col">
                                  <span className={`font-medium ${
                                    (notebook.stats?.audio_block_count || 0) > 0 
                                      ? 'font-bold text-orange-400' 
                                      : ''
                                  }`}>
                                    {formatNumber(notebook.stats?.audio_block_count || 0)}
                                  </span>
                                  <span className={`${
                                    (notebook.stats?.audio_block_count || 0) > 0 
                                      ? 'text-orange-400' 
                                      : 'text-gray-400'
                                  }`}>
                                    点读块
                                  </span>
                                </div>
                              </CardItem>
                            </div>
                            
                            {/* 打开按钮单独一行，宽度占满 */}
                            <CardItem
                              translateZ={35}
                              rotateY="0.8"
                              as={Link}
                              href={`/content/${notebook.id}`}
                              className="w-full px-2 py-1 lg:px-3 lg:py-1.5 rounded-md bg-gradient-to-tr from-purple-600 to-purple-500 text-white text-[10px] lg:text-xs font-bold flex items-center justify-center hover:shadow-sm hover:shadow-purple-500/20 transition-all"
                            >
                              打开笔记本 <ChevronRight className="w-2 h-2 lg:w-3 lg:h-3 ml-0.5 lg:ml-1" />
                            </CardItem>
                          </div>
                        </div>
                        
                        <CardItem
                          as="button"
                          translateZ="50"
                          rotateZ="1"
                          onClick={(e: React.MouseEvent) => toggleMenu(notebook.id, e)}
                          className="absolute right-1.5 top-1.5 lg:right-2 lg:top-2 z-20 p-1 lg:p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white transition-all hover:bg-black/60"
                          ref={(el: HTMLButtonElement | null) => activeMenuButtonRef.current[notebook.id] = el}
                        >
                          <MoreHorizontal className="w-3 h-3 lg:w-4 lg:h-4" />
                        </CardItem>
                        
                        {expandedMenus[notebook.id] && renderNotebookMenu(notebook)}
                      </CardBody>
                    </CardContainer>
                    
                    {/* 编辑加载状态覆盖层 - 移到CardContainer外部，作为兄弟元素 */}
                    {editingNotebookIds[notebook.id] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-lg z-[100]">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="relative w-10 h-10">
                            <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin"></div>
                            <div className="absolute inset-1 rounded-full border-r-2 border-purple-300/30 animate-spin animate-delay-150"></div>
                            <div className="absolute inset-2 rounded-full border-b-2 border-purple-400/50 animate-spin animate-delay-300"></div>
                          </div>
                          <div className="text-xs text-purple-400 font-medium">加载编辑信息</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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

      {/* 编辑笔记本对话框 */}
      {editingNotebook && (
        <NotebookEditDialog
          notebook={editingNotebook}
          resources={notebookResources.filter(r => r.resource_type === 'image')}
          resourcesLoading={resourcesLoading}
          isOpen={showEditDialog}
          onOpenChange={handleEditDialogChange}
          onSave={saveNotebookInfo}
          isSaving={savingNotebook}
        />
      )}
    </div>
  );
}