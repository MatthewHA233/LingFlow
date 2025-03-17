'use client';

import { useEffect, useState, useRef } from 'react';
import { Book } from '@/types/book';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase-client';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Upload, BookOpen, Mail, Lock, X, ChevronRight, MoreHorizontal, Trash, Share, Edit, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { UnauthorizedTip } from '@/components/auth/UnauthorizedTip';
import { updateBookCover } from '@/lib/book-cover-utils';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { toast } from 'sonner';
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// 将bookFormSchema移动到全局范围内，以便在两个组件中都能访问
const bookFormSchema = z.object({
  title: z.string().min(1, "书名不能为空"),
  author: z.string().optional(),
  publisher: z.string().optional(),
  language: z.string().optional(),
  cover_url: z.string().optional(),
});

export default function BookshelfPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [placeholderStates, setPlaceholderStates] = useState<Record<string, boolean>>({});
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const { user } = useAuthStore();
  const router = useRouter();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bookResources, setBookResources] = useState<Array<any>>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [savingBook, setSavingBook] = useState(false);
  const [editingBookIds, setEditingBookIds] = useState<Record<string, boolean>>({});

  // 添加引用以跟踪当前活动的菜单
  const activeMenuButtonRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeMenuRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    async function loadBooks() {
      if (!user) return;

      try {
        // 首先尝试不带统计信息的基本查询
        const { data: basicData, error: basicError } = await supabase
          .from('books')
          .select(`
            *,
            chapters (*, order_index)
          `)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (basicError) throw basicError;

        // 确保章节按顺序排列
        const booksWithSortedChapters = (basicData || []).map(book => ({
          ...book,
          chapters: book.chapters?.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index) || [],
          stats: {
            chapter_count: book.chapters?.length || 0,
            text_block_count: 0,
            audio_block_count: 0,
            image_block_count: 0,
            total_block_count: 0
          }
        }));

        // 然后尝试获取统计数据
        try {
          // 使用IN查询各书本的统计信息
          const bookIds = booksWithSortedChapters.map(book => book.id);
          if (bookIds.length > 0) {
            const { data: statsData } = await supabase
              .from('book_statistics')
              .select('book_id, chapter_count, text_block_count, audio_block_count, image_block_count, total_block_count')
              .in('book_id', bookIds);

            // 如果获取到统计数据，合并到书籍对象中
            if (statsData && statsData.length > 0) {
              const statsMap = statsData.reduce((acc, stat) => {
                acc[stat.book_id] = stat;
                return acc;
              }, {} as Record<string, any>);

              // 更新书籍数据，添加统计信息
              booksWithSortedChapters.forEach(book => {
                if (statsMap[book.id]) {
                  book.stats = {
                    chapter_count: statsMap[book.id].chapter_count || book.chapters?.length || 0,
                    text_block_count: statsMap[book.id].text_block_count || 0,
                    audio_block_count: statsMap[book.id].audio_block_count || 0,
                    image_block_count: statsMap[book.id].image_block_count || 0,
                    total_block_count: statsMap[book.id].total_block_count || 0
                  };
                }
              });
            }
          }
        } catch (statsError) {
          console.warn('获取统计数据失败，使用默认值:', statsError);
          // 统计查询失败不影响整体功能，继续使用默认值
        }

        // 检查并更新所有书籍的封面
        const updatedBooks = await Promise.all(
          booksWithSortedChapters.map(updateBookCover)
        );
        
        setBooks(updatedBooks);
      } catch (error) {
        console.error('加载书架失败:', error);
      } finally {
        setLoading(false);
      }
    }

    loadBooks();
  }, [user]);

  const handleDeleteBook = async (bookId: string, title: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 关闭菜单
    setExpandedMenus(prev => ({...prev, [bookId]: false}));

    confirmAlert({
      title: '确认删除',
      message: `确定要删除《${title}》吗？此操作不可恢复。`,
      buttons: [
        {
          label: '取消',
          onClick: () => {}
        },
        {
          label: '删除',
          onClick: async () => {
            // 创建一个持续的 toast
            const toastId = toast.loading(`正在删除《${title}》...`, {
              duration: Infinity,
            });
            
            try {
              // 先将书籍标记为正在删除状态
              setBooks(books.map(book => 
                book.id === bookId 
                  ? { ...book, isDeleting: true } 
                  : book
              ));

              const response = await fetch(`/api/books/delete`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({ bookId })
              });

              if (!response.ok) {
                throw new Error('删除失败');
              }

              const data = await response.json();
              
              // 更新 toast 为成功
              toast.success(`《${title}》已删除`, {
                id: toastId,
                duration: 3000,
              });

              // 从列表中移除
              setBooks(books.filter(book => book.id !== bookId));

            } catch (error) {
              console.error('删除书籍失败:', error);
              // 更新 toast 为错误
              toast.error(`删除《${title}》失败，请重试`, {
                id: toastId,
                duration: 3000,
              });
              
              // 恢复书籍状态
              setBooks(books.map(book => 
                book.id === bookId 
                  ? { ...book, isDeleting: false }
                  : book
              ));
            }
          },
          className: 'react-confirm-alert-button-red'
        }
      ]
    });
  };

  const toggleMenu = (bookId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 关闭所有其他打开的菜单，只保持当前菜单状态切换
    setExpandedMenus(prev => {
      const newState = { ...prev };
      
      // 清除所有其他打开的菜单
      Object.keys(newState).forEach(id => {
        if (id !== bookId) newState[id] = false;
      });
      
      // 切换当前菜单状态
      newState[bookId] = !prev[bookId];
      
      return newState;
    });
  };

  // 处理普通按钮点击，关闭菜单
  const handleMenuItemClick = (bookId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedMenus(prev => ({...prev, [bookId]: false}));
    // 在这里可以添加额外的操作，比如导航等
  };

  function formatNumber(num: number): string {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // 处理编辑按钮点击
  const handleEditBook = async (book: Book, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 关闭菜单
    setExpandedMenus(prev => ({...prev, [book.id]: false}));
    
    // 关闭任何已经打开的编辑对话框
    setShowEditDialog(false);
    
    // 清除之前的编辑书籍和资源
    setEditingBook(null);
    setBookResources([]);
    
    // 设置编辑加载状态
    setEditingBookIds(prev => ({...prev, [book.id]: true}));
    
    try {
      // 设置正在编辑的书籍
      setEditingBook(book);
      
      // 加载书籍资源
      await loadBookResources(book.id);
      
      // 显示编辑对话框
      setShowEditDialog(true);
    } catch (error) {
      console.error('准备编辑书籍时出错:', error);
      toast.error('加载编辑信息失败');
    } finally {
      // 无论成功失败，都清除加载状态
      setEditingBookIds(prev => ({...prev, [book.id]: false}));
    }
  };
  
  // 加载书籍资源
  const loadBookResources = async (bookId: string) => {
    try {
      setResourcesLoading(true);
      const response = await fetch(`/api/books/${bookId}/resources`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (!response.ok) throw new Error('加载资源失败');
      
      const data = await response.json();
      setBookResources(data.resources || []);
    } catch (error) {
      console.error('加载资源失败:', error);
      toast.error('加载资源失败');
    } finally {
      setResourcesLoading(false);
    }
  };
  
  // 保存书籍信息
  const saveBookInfo = async (values: z.infer<typeof bookFormSchema>) => {
    if (!editingBook) return;
    
    try {
      setSavingBook(true);
      
      const response = await fetch(`/api/books/update-cover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          bookId: editingBook.id,
          title: values.title,
          author: values.author,
          coverUrl: values.cover_url,
          metadata: {
            ...(editingBook.metadata || {}),
            publisher: values.publisher,
            language: values.language,
          }
        })
      });
      
      if (!response.ok) throw new Error('更新书籍信息失败');
      
      const data = await response.json();
      
      // 更新本地书籍数据
      setBooks(books.map(book => 
        book.id === editingBook.id
          ? {
              ...book,
              title: values.title,
              author: values.author || book.author,
              cover_url: values.cover_url || book.cover_url,
              metadata: {
                ...(book.metadata || {}),
                publisher: values.publisher,
                language: values.language,
              }
            }
          : book
      ));
      
      toast.success('书籍信息已更新');
      setShowEditDialog(false);
    } catch (error) {
      console.error('更新书籍信息失败:', error);
      toast.error('更新书籍信息失败');
    } finally {
      setSavingBook(false);
    }
  };

  // 在菜单项中添加编辑功能
  const renderBookMenu = (book: Book) => (
    <CardItem
      translateZ="70"
      rotateZ="-0.5"
      className="absolute right-1.5 top-7 lg:right-2 lg:top-9 z-30 bg-black border border-white/10 rounded-lg shadow-lg overflow-hidden [transform-style:preserve-3d] w-28 lg:w-36"
      ref={(el: HTMLDivElement | null) => activeMenuRef.current[book.id] = el}
    >
      <button 
        onClick={(e) => handleDeleteBook(book.id, book.title, e)}
        className="flex items-center px-3 py-2 lg:px-4 lg:py-2.5 text-xs lg:text-sm text-white w-full hover:bg-red-900/40 transition-colors border-b border-white/10"
      >
        <Trash className="w-3 h-3 lg:w-4 lg:h-4 mr-2" />
        <span>删除</span>
      </button>
      
      <button 
        onClick={(e) => handleEditBook(book, e)}
        className="flex items-center px-3 py-2 lg:px-4 lg:py-2.5 text-xs lg:text-sm text-white w-full hover:bg-white/10 transition-colors border-b border-white/10"
      >
        <Edit className="w-3 h-3 lg:w-4 lg:h-4 mr-2" />
        <span>编辑信息</span>
      </button>
      
      <button 
        onClick={(e) => handleMenuItemClick(book.id, e)}
        className="flex items-center px-3 py-2 lg:px-4 lg:py-2.5 text-xs lg:text-sm text-white w-full hover:bg-white/10 transition-colors"
      >
        <Share className="w-3 h-3 lg:w-4 lg:h-4 mr-2" />
        <span>分享</span>
      </button>
    </CardItem>
  );

  // 在BookshelfPage组件中添加一个函数来处理对话框关闭
  const handleEditDialogChange = (open: boolean) => {
    if (!open) {
      // 如果对话框正在关闭，清理状态
      setTimeout(() => {
        setEditingBook(null);
        setBookResources([]);
      }, 300); // 等待对话框关闭动画完成
    }
    setShowEditDialog(open);
  };

  if (!user) {
    return <UnauthorizedTip />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 更有高级感的标题区域 */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center">
          <h1 className="relative text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-300 pb-0.5">
            我的书架
            <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500/70 via-emerald-400 to-transparent"></div>
          </h1>
          <div className="ml-3 px-2 py-0.5 rounded-full text-[10px] border border-emerald-500/30 text-emerald-400 bg-emerald-950/30">
            {books.length} 本书
          </div>
        </div>
        
        <Link href="/reader">
          <HoverBorderGradient
            containerClassName="rounded-full"
            className="flex items-center gap-2 text-sm"
            as="button"
          >
            <Upload className="w-4 h-4" />
            <span>导入新书</span>
          </HoverBorderGradient>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="relative">
              <div className="bg-black border border-white/[0.2] rounded-lg p-2 h-auto overflow-hidden">
                {/* 标题骨架 */}
                <Skeleton className="h-4 w-4/5 mb-0.5 bg-gray-800" />
                
                {/* 作者骨架 */}
                <Skeleton className="h-2.5 w-3/5 mb-1.5 bg-gray-800" />
                
                {/* 封面图片骨架 - 较短的高度 */}
                <Skeleton className="w-full aspect-[3/2.2] lg:aspect-[3/2] rounded-lg mb-2 bg-gray-800" />
                
                {/* 进度条骨架 */}
                <Skeleton className="h-1 w-full mb-0.5 bg-gray-800" />
                <Skeleton className="h-2 w-1/4 mb-1.5 bg-gray-800" />
                
                {/* 统计数据骨架 */}
                <div className="grid grid-cols-5 gap-0.5 mb-1">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="flex flex-col items-center">
                      <Skeleton className="h-2 w-6 mb-0.5 bg-gray-800" />
                      <Skeleton className="h-1.5 w-4 bg-gray-800" />
                    </div>
                  ))}
                </div>
                
                {/* 阅读按钮骨架 */}
                <Skeleton className="h-6 w-full rounded-md mt-1 bg-gray-800" />
              </div>
              
              {/* 添加高级感的动画效果 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shine rounded-lg" />
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">您的书架还是空的</h2>
          <p className="text-muted-foreground mb-4">导入您的第一本有声书开始阅读之旅吧</p>
          <Link href="/reader">
            <HoverBorderGradient
              containerClassName="rounded-full mx-auto"
              className="flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>开始导入</span>
            </HoverBorderGradient>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {books.map((book) => (
            <div key={book.id} className={`relative transition-all duration-500 ${
              book.isDeleting ? 'opacity-50 blur-sm scale-95' : ''
            }`}>
              <CardContainer className="!p-0 !m-0 h-auto" containerClassName="!p-0 !m-0 h-auto !perspective-[1000px]">
                <CardBody className={`relative bg-black border border-white/[0.2] w-full h-auto rounded-lg lg:p-3 p-2 group/card hover:shadow-lg hover:shadow-emerald-500/[0.1] ${
                  book.isDeleting ? 'pointer-events-none' : ''
                }`}>
                  <div className="flex flex-col h-full">
                    <CardItem
                      translateZ="35"
                      rotateX="-2"
                      className="text-sm lg:text-base font-bold text-white mb-0.5 truncate text-shadow-sm"
                    >
                      {book.title}
                    </CardItem>
                    
                    <CardItem
                      as="p"
                      translateZ="40"
                      rotateX="-1"
                      rotateY="0.5"
                      className="text-neutral-300 text-[10px] lg:text-xs mb-1.5 truncate"
                    >
                      {book.author || "未知作者"}
                    </CardItem>
                    
                    <CardItem 
                      translateZ="45" 
                      rotateY="1.5"
                      className="w-full mb-2"
                    >
                      <div className="relative aspect-[3/2.2] lg:aspect-[3/2] bg-gray-800 rounded-lg overflow-hidden shadow-[0_4px_8px_rgba(0,0,0,0.3)]">
                        {book.cover_url ? (
                          <Image
                            src={book.cover_url}
                            alt={book.title}
                            fill
                            className="object-cover group-hover/card:shadow-xl"
                            onError={(e) => {
                              try {
                                const img = e.target as HTMLImageElement;
                                img.style.display = 'none';
                                setPlaceholderStates(prev => ({...prev, [book.id]: true}));
                              } catch (error) {
                                console.error('处理封面失败:', error);
                                setPlaceholderStates(prev => ({...prev, [book.id]: true}));
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        
                        {placeholderStates[book.id] && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                            <BookOpen className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </CardItem>
                    
                    {book.progress && (
                      <CardItem translateZ="30" rotateX="0.8" className="w-full mb-1.5">
                        <div className="w-full h-1 lg:h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${book.progress}%` }}
                          />
                        </div>
                        <p className="text-[9px] lg:text-[11px] text-gray-400 mt-0.5">阅读进度: {Math.round(book.progress)}%</p>
                      </CardItem>
                    )}
                    
                    <div className="flex flex-col mt-auto space-y-1">
                      {/* 统计数据 - 突出显示章节和语境块 */}
                      <div className="grid grid-cols-5 w-full gap-0.5 mb-1">
                        {/* 章节 - 高亮显示 */}
                        <CardItem
                          translateZ={25}
                          className="text-[8px] lg:text-[11px] text-center"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-white">{book.chapters?.length || 0}</span>
                            <span className="text-emerald-400">章节</span>
                          </div>
                        </CardItem>
                        
                        {/* 语境块 - 高亮显示 */}
                        <CardItem
                          translateZ={25}
                          className="text-[8px] lg:text-[11px] text-center"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-white">{formatNumber(book.stats?.total_block_count || 0)}</span>
                            <span className="text-emerald-400">语境块</span>
                          </div>
                        </CardItem>
                        
                        {/* 其他三个项目保持稍暗状态 */}
                        <CardItem
                          translateZ={15}
                          className="text-[8px] lg:text-[11px] text-center opacity-70"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{formatNumber(book.stats?.text_block_count || 0)}</span>
                            <span className="text-gray-400">文本块</span>
                          </div>
                        </CardItem>
                        
                        <CardItem
                          translateZ={15}
                          className="text-[8px] lg:text-[11px] text-center opacity-70"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{formatNumber(book.stats?.image_block_count || 0)}</span>
                            <span className="text-gray-400">图片块</span>
                          </div>
                        </CardItem>

                        {/* 点读块 - 当数量大于0时使用橙色强调 */}
                        <CardItem
                          translateZ={15}
                          className={`text-[8px] lg:text-[11px] text-center ${
                            (book.stats?.audio_block_count || 0) > 0 
                              ? 'opacity-100' 
                              : 'opacity-70'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className={`font-medium ${
                              (book.stats?.audio_block_count || 0) > 0 
                                ? 'font-bold text-orange-400' 
                                : ''
                            }`}>
                              {formatNumber(book.stats?.audio_block_count || 0)}
                            </span>
                            <span className={`${
                              (book.stats?.audio_block_count || 0) > 0 
                                ? 'text-orange-400' 
                                : 'text-gray-400'
                            }`}>
                              点读块
                            </span>
                          </div>
                        </CardItem>
                      </div>
                      
                      {/* 阅读按钮单独一行，宽度占满 */}
                      <CardItem
                        translateZ={35}
                        rotateY="0.8"
                        as={Link}
                        href={`/reader/${book.id}`}
                        className="w-full px-2 py-1 lg:px-3 lg:py-1.5 rounded-md bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white text-[10px] lg:text-xs font-bold flex items-center justify-center hover:shadow-sm hover:shadow-emerald-500/20 transition-all"
                      >
                        阅读 <ChevronRight className="w-2 h-2 lg:w-3 lg:h-3 ml-0.5 lg:ml-1" />
                      </CardItem>
                    </div>
                  </div>
                  
                  <CardItem
                    as="button"
                    translateZ="50"
                    rotateZ="1"
                    onClick={(e: React.MouseEvent) => toggleMenu(book.id, e)}
                    className="absolute right-1.5 top-1.5 lg:right-2 lg:top-2 z-20 p-1 lg:p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white transition-all hover:bg-black/60"
                    ref={(el: HTMLButtonElement | null) => activeMenuButtonRef.current[book.id] = el}
                  >
                    <MoreHorizontal className="w-3 h-3 lg:w-4 lg:h-4" />
                  </CardItem>
                  
                  {expandedMenus[book.id] && renderBookMenu(book)}
                </CardBody>
              </CardContainer>
              
              {/* 编辑加载状态 - 移到CardContainer外部，作为兄弟元素 */}
              {editingBookIds[book.id] && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-lg z-[100]">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 rounded-full border-t-2 border-emerald-500 animate-spin"></div>
                      <div className="absolute inset-1 rounded-full border-r-2 border-emerald-300/30 animate-spin animate-delay-150"></div>
                      <div className="absolute inset-2 rounded-full border-b-2 border-emerald-400/50 animate-spin animate-delay-300"></div>
                    </div>
                    <div className="text-xs text-emerald-400 font-medium">加载编辑信息</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* 编辑书籍对话框 */}
      {editingBook && (
        <BookEditDialog
          book={editingBook}
          resources={bookResources.filter(r => r.resource_type === 'image')}
          resourcesLoading={resourcesLoading}
          isOpen={showEditDialog}
          onOpenChange={handleEditDialogChange}
          onSave={saveBookInfo}
          isSaving={savingBook}
        />
      )}
    </div>
  );
}

// 编辑书籍信息对话框组件
function BookEditDialog({ 
  book, 
  resources, 
  resourcesLoading, 
  isOpen, 
  onOpenChange, 
  onSave,
  isSaving
}: { 
  book: Book, 
  resources: any[], 
  resourcesLoading: boolean,
  isOpen: boolean, 
  onOpenChange: (open: boolean) => void,
  onSave: (values: any) => Promise<void>,
  isSaving: boolean
}) {
  // 表单定义 - 先定义表单
  const form = useForm({
    resolver: zodResolver(bookFormSchema),
    defaultValues: {
      title: book?.title || '',
      author: book?.author || '',
      publisher: book?.metadata?.publisher || '',
      language: book?.metadata?.language || '',
      cover_url: book?.cover_url || '',
    }
  });
  
  // 选中的封面状态
  const [selectedCover, setSelectedCover] = useState(book?.cover_url || '');
  
  // 添加编辑状态跟踪
  const [editableFields, setEditableFields] = useState<Record<string, boolean>>({
    title: false,
    author: false,
    publisher: false,
    language: false,
    cover_url: false
  });
  
  // 在BookEditDialog组件内，添加原始值跟踪
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({});

  // 在useEffect中初始化原始值
  useEffect(() => {
    if (book) {
      setOriginalValues({
        title: book.title || '',
        author: book.author || '',
        publisher: book.metadata?.publisher || '',
        language: book.metadata?.language || '',
        cover_url: book.cover_url || ''
      });
    }
  }, [book]);
  
  // 使用useEffect监听book变化时重置表单，并添加正确的依赖项
  useEffect(() => {
    if (book && isOpen) {
      // 重置表单值
      form.reset({
        title: book.title,
        author: book.author || '',
        publisher: book.metadata?.publisher || '',
        language: book.metadata?.language || '',
        cover_url: book.cover_url || '',
      });
      
      // 重置选中封面
      setSelectedCover(book.cover_url || '');
      
      // 重置编辑状态
      setEditableFields({
        title: false,
        author: false,
        publisher: false,
        language: false,
        cover_url: false
      });
    }
  }, [book, isOpen, form]); // 添加正确的依赖项
  
  // 切换字段的可编辑状态
  const toggleFieldEdit = (fieldName: string, forceState?: boolean) => {
    setEditableFields(prev => ({
      ...prev,
      [fieldName]: forceState !== undefined ? forceState : !prev[fieldName]
    }));
  };
  
  // 检查字段是否已更改
  const isFieldChanged = (fieldName: "title" | "author" | "publisher" | "language" | "cover_url") => {
    const currentValue = form.getValues(fieldName);
    return currentValue !== originalValues[fieldName];
  };
  
  // 选择封面
  const handleSelectCover = (url: string) => {
    setSelectedCover(url);
    form.setValue('cover_url', url);
  };
  
  // 提交表单
  const onSubmit = async (values: z.infer<typeof bookFormSchema>) => {
    await onSave(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border border-white/[0.2] shadow-emerald-500/10 max-w-2xl max-h-[85vh] rounded-xl overflow-hidden p-4">
        <DialogHeader className="mb-2">
          <DialogTitle className="relative text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-300 pb-0.5">
            编辑书籍信息
            <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500/70 via-emerald-400 to-transparent"></div>
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            修改书籍的基本信息和封面图片
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="grid w-full grid-cols-2 bg-black/50 border border-white/10 rounded-lg p-1">
            <TabsTrigger 
              value="info" 
              className="data-[state=active]:bg-emerald-950 data-[state=active]:text-emerald-300"
            >
              基本信息
            </TabsTrigger>
            <TabsTrigger 
              value="cover" 
              className="data-[state=active]:bg-emerald-950 data-[state=active]:text-emerald-300"
            >
              选择封面
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="info" className="mt-3">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <div className="flex gap-4">
                  {/* 封面预览 */}
                  {selectedCover && (
                    <div className="w-28 h-40 flex-shrink-0 rounded-md border border-white/10 bg-black/20 overflow-hidden relative">
                      <Image
                        src={selectedCover}
                        alt="封面预览"
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 space-y-3">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300 text-sm">书名</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field} 
                                className={`h-9 bg-black/40 border-white/10 focus:border-emerald-500/50 text-white pr-10 
                                  ${!editableFields.title ? 'cursor-default' : ''}
                                  ${isFieldChanged('title') ? 'border-amber-500/40 border-opacity-70' : ''}
                                `}
                                readOnly={!editableFields.title}
                                ref={(input) => {
                                  if (editableFields.title && input) {
                                    input.focus();
                                  }
                                }}
                                onBlur={() => {
                                  toggleFieldEdit('title', false);
                                  // 如果值已更改，添加变更指示器
                                  if (isFieldChanged('title')) {
                                    // 值已更改，样式会通过className应用
                                  }
                                }}
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                                {/* 显示更改指示器 */}
                                {isFieldChanged('title') && (
                                  <span className="w-2 h-2 rounded-full bg-amber-400 mr-2" title="值已更改"></span>
                                )}
                                <button 
                                  type="button"
                                  onClick={() => {
                                    toggleFieldEdit('title');
                                    setTimeout(() => {
                                      const input = document.querySelector('input[name="title"]') as HTMLInputElement;
                                      if (input) input.focus();
                                    }, 0);
                                  }}
                                  className="text-gray-400 hover:text-emerald-500 transition-colors"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400 text-xs" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="author"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300 text-sm">作者</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field} 
                                className={`h-9 bg-black/40 border-white/10 focus:border-emerald-500/50 text-white pr-10 
                                  ${!editableFields.author ? 'cursor-default' : ''}
                                  ${isFieldChanged('author') ? 'border-amber-500/40 border-opacity-70' : ''}
                                `}
                                readOnly={!editableFields.author}
                                ref={(input) => {
                                  if (editableFields.author && input) {
                                    input.focus();
                                  }
                                }}
                                onBlur={() => {
                                  toggleFieldEdit('author', false);
                                  // 如果值已更改，添加变更指示器
                                  if (isFieldChanged('author')) {
                                    // 值已更改，样式会通过className应用
                                  }
                                }}
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                                {/* 显示更改指示器 */}
                                {isFieldChanged('author') && (
                                  <span className="w-2 h-2 rounded-full bg-amber-400 mr-2" title="值已更改"></span>
                                )}
                                <button 
                                  type="button"
                                  onClick={() => {
                                    toggleFieldEdit('author');
                                    setTimeout(() => {
                                      const input = document.querySelector('input[name="author"]') as HTMLInputElement;
                                      if (input) input.focus();
                                    }, 0);
                                  }}
                                  className="text-gray-400 hover:text-emerald-500 transition-colors"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400 text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="publisher"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">出版社</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              {...field} 
                              className={`h-9 bg-black/40 border-white/10 focus:border-emerald-500/50 text-white pr-10 
                                ${!editableFields.publisher ? 'cursor-default' : ''}
                                ${isFieldChanged('publisher') ? 'border-amber-500/40 border-opacity-70' : ''}
                              `}
                              readOnly={!editableFields.publisher}
                              ref={(input) => {
                                if (editableFields.publisher && input) {
                                  input.focus();
                                }
                              }}
                              onBlur={() => {
                                toggleFieldEdit('publisher', false);
                                // 如果值已更改，添加变更指示器
                                if (isFieldChanged('publisher')) {
                                  // 值已更改，样式会通过className应用
                                }
                              }}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                              {/* 显示更改指示器 */}
                              {isFieldChanged('publisher') && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 mr-2" title="值已更改"></span>
                              )}
                              <button 
                                type="button"
                                onClick={() => {
                                  toggleFieldEdit('publisher');
                                  setTimeout(() => {
                                    const input = document.querySelector('input[name="publisher"]') as HTMLInputElement;
                                    if (input) input.focus();
                                  }, 0);
                                }}
                                className="text-gray-400 hover:text-emerald-500 transition-colors"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">语言</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              {...field} 
                              className={`h-9 bg-black/40 border-white/10 focus:border-emerald-500/50 text-white pr-10 
                                ${!editableFields.language ? 'cursor-default' : ''}
                                ${isFieldChanged('language') ? 'border-amber-500/40 border-opacity-70' : ''}
                              `}
                              readOnly={!editableFields.language}
                              ref={(input) => {
                                if (editableFields.language && input) {
                                  input.focus();
                                }
                              }}
                              onBlur={() => {
                                toggleFieldEdit('language', false);
                                // 如果值已更改，添加变更指示器
                                if (isFieldChanged('language')) {
                                  // 值已更改，样式会通过className应用
                                }
                              }}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                              {/* 显示更改指示器 */}
                              {isFieldChanged('language') && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 mr-2" title="值已更改"></span>
                              )}
                              <button 
                                type="button"
                                onClick={() => {
                                  toggleFieldEdit('language');
                                  setTimeout(() => {
                                    const input = document.querySelector('input[name="language"]') as HTMLInputElement;
                                    if (input) input.focus();
                                  }, 0);
                                }}
                                className="text-gray-400 hover:text-emerald-500 transition-colors"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="cover_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 text-sm">封面链接</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            {...field} 
                            className={`h-9 bg-black/40 border-white/10 focus:border-emerald-500/50 text-white font-mono text-xs pr-20 
                              ${!editableFields.cover_url ? 'cursor-default' : ''}
                              ${isFieldChanged('cover_url') ? 'border-amber-500/40 border-opacity-70' : ''}
                            `}
                            readOnly={!editableFields.cover_url}
                            ref={(input) => {
                              if (editableFields.cover_url && input) {
                                input.focus();
                              }
                            }}
                            onChange={(e) => {
                              field.onChange(e);
                              setSelectedCover(e.target.value);
                            }}
                            onBlur={() => {
                              toggleFieldEdit('cover_url', false);
                            }}
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2 items-center">
                            {/* 显示更改指示器 */}
                            {isFieldChanged('cover_url') && (
                              <span className="w-2 h-2 rounded-full bg-amber-400" title="值已更改"></span>
                            )}
                            {/* 查看/下载按钮 */}
                            {field.value && (
                              <a 
                                href={field.value} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-emerald-500 transition-colors"
                                title="查看/下载"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {/* 编辑按钮 */}
                            <button 
                              type="button"
                              onClick={() => {
                                toggleFieldEdit('cover_url');
                                setTimeout(() => {
                                  const input = document.querySelector('input[name="cover_url"]') as HTMLInputElement;
                                  if (input) input.focus();
                                }, 0);
                              }}
                              className="text-gray-400 hover:text-emerald-500 transition-colors"
                              title="编辑"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="cover" className="mt-3">
            <div className="h-[320px] overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
              {resourcesLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-emerald-500"></div>
                </div>
              ) : resources.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-2 text-gray-400">
                  <BookOpen className="h-8 w-8" />
                  <p>没有发现可用的图片资源</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {resources.map((resource) => (
                    <div 
                      key={resource.id} 
                      className={`
                        relative aspect-[3/4] bg-black/70 rounded-lg overflow-hidden cursor-pointer
                        border transition-all duration-200
                        ${selectedCover === resource.oss_path 
                          ? 'border-emerald-500 shadow-emerald-500/20 shadow-md' 
                          : 'border-white/10 hover:border-white/30'
                        }
                      `}
                      onClick={() => handleSelectCover(resource.oss_path)}
                    >
                      <Image
                        src={resource.oss_path}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 33vw, 25vw"
                        priority={selectedCover === resource.oss_path}
                        onError={(e) => {
                          // 处理图片加载错误
                          const target = e.target as HTMLImageElement;
                          target.src = "/placeholder-image.png"; // 提供一个占位图
                          console.error(`图片加载失败: ${resource.oss_path}`);
                        }}
                      />
                      
                      {selectedCover === resource.oss_path && (
                        <div className="absolute bottom-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-md z-10">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4 space-x-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="h-9 bg-transparent border-emerald-800/30 text-gray-300 hover:text-emerald-400 hover:border-emerald-600/50 hover:bg-emerald-950/30 transition-colors"
          >
            取消
          </Button>
          <Button 
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSaving}
            className="h-9 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white"
          >
            {isSaving ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-b-2 border-white rounded-full"></div>
                保存中...
              </>
            ) : "保存更改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 