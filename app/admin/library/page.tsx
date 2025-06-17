'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Book } from '@/types/book';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import Image from 'next/image';
import { X, Search, User, Calendar, Clock, BookOpen, Globe, Building, Info, ChevronDown, ImageIcon, Type, FileCode, File, MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { confirmAlert } from 'react-confirm-alert';
import Link from 'next/link';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import 'react-confirm-alert/src/react-confirm-alert.css';

interface BookWithUser extends Book {
  user_email: string;
  isDeleting?: boolean;
  bookResources?: Array<{
    id: string;
    book_id: string;
    chapter_id?: string;
    original_path: string;
    oss_path: string;
    resource_type: string;
    mime_type: string;
    created_at: string;
    metadata?: any;
    context_block_id?: string;
  }>;
  resource_count?: number;
}

interface BookResponse extends Book {
  profiles: {
    email: string;
  };
}

// 语言选项
const languageOptions = [
  { value: 'all', label: '所有语言' },
  { value: 'zh', label: '中文 (zh)' },
  { value: 'zh-CN', label: '中文 (zh-CN)' },
  { value: 'zh-TW', label: '繁体中文 (zh-TW)' },
  { value: 'en', label: '英文 (en)' },
  { value: 'en-US', label: '美式英文 (en-US)' },
  { value: 'en-GB', label: '英式英文 (en-GB)' },
  { value: 'ja', label: '日文 (ja)' },
  { value: 'fr', label: '法文 (fr)' },
  { value: 'de', label: '德文 (de)' },
  { value: 'es', label: '西班牙文 (es)' },
  { value: 'ko', label: '韩文 (ko)' },
  { value: 'ru', label: '俄文 (ru)' },
];

// 排序选项
const sortOptions = [
  { value: 'title', label: '按书名' },
  { value: 'author', label: '按作者' },
  { value: 'created_at', label: '按创建时间' },
  { value: 'updated_at', label: '按更新时间' },
];

export default function AdminLibraryPage() {
  const [books, setBooks] = useState<BookWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBook, setSelectedBook] = useState<BookWithUser | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [languageFilter, setLanguageFilter] = useState('all');
  const { user } = useAuthStore();
  const isInitialMount = useRef(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  const loadBooks = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/books?page=${pageNum}&pageSize=${pageSize}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('获取图书列表失败');
      }

      const data = await response.json();
      
      const booksWithUser = data.books.map((book: any) => ({
        ...book,
        user_email: book.profiles.email,
        isDeleting: false
      }));

      setBooks(booksWithUser);
      setTotalBooks(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
      setPage(data.pagination.page);
    } catch (error) {
      console.error('加载图书失败:', error);
      toast.error('加载图书失败');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    if (user && isInitialMount.current) {
      loadBooks();
      isInitialMount.current = false;
    }
  }, [user, loadBooks]);

  const handleDeleteBook = async (book: BookWithUser, deleteResources = false) => {
    const message = deleteResources 
      ? `确定要删除用户 ${book.user_email} 的《${book.title}》及其全部资源文件吗？此操作不可恢复。`
      : `确定要删除用户 ${book.user_email} 的《${book.title}》吗？此操作不可恢复。`;
      
    confirmAlert({
      title: '确认删除',
      message,
      buttons: [
        {
          label: '取消',
          onClick: () => {}
        },
        {
          label: '删除',
          onClick: async () => {
            const toastId = toast.loading(`正在删除《${book.title}》...`);
            
            try {
              setBooks(books.map(b => 
                b.id === book.id ? { ...b, isDeleting: true } : b
              ));

              const response = await fetch(`/api/admin/books/delete`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({ 
                  bookId: book.id,
                  deleteResources
                })
              });

              if (!response.ok) throw new Error('删除失败');

              toast.success(`《${book.title}》已删除`, { id: toastId });
              setBooks(books.filter(b => b.id !== book.id));
              setTotalBooks(prev => prev - 1);
              
              // 如果当前正在显示该书的详情，则关闭详情
              if (selectedBook?.id === book.id) {
                setShowDetails(false);
              }
            } catch (error) {
              console.error('删除失败:', error);
              toast.error(`删除失败: ${error}`, { id: toastId });
              setBooks(books.map(b => 
                b.id === book.id ? { ...b, isDeleting: false } : b
              ));
            }
          },
          className: 'react-confirm-alert-button-red'
        }
      ]
    });
  };

  const handleViewDetails = (book: BookWithUser) => {
    setSelectedBook(book);
    setShowDetails(true);
    
    // 重置资源加载状态
    setResourcesLoaded(false);
    setResourcesLoading(false);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  // 根据筛选条件过滤图书
  const filteredBooks = books.filter(book => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.user_email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 更智能的语言匹配
    const matchesLanguage = 
      languageFilter === 'all' || 
      (book.metadata?.language && (
        // 完全匹配
        book.metadata.language.toLowerCase() === languageFilter.toLowerCase() ||
        // 前缀匹配 (例如 'zh-CN' 匹配 'zh' 过滤器)
        (languageFilter.length === 2 && book.metadata.language.toLowerCase().startsWith(languageFilter.toLowerCase())) ||
        // 处理大小写不一致的情况
        book.metadata.language.toLowerCase() === 'zh-cn' && languageFilter.toLowerCase() === 'zh-cn' ||
        book.metadata.language.toLowerCase() === 'zh-tw' && languageFilter.toLowerCase() === 'zh-tw'
      ));
    
    return matchesSearch && matchesLanguage;
  });

  // 对过滤后的图书进行排序
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    let valueA, valueB;
    
    switch (sortBy) {
      case 'title':
        valueA = a.title.toLowerCase();
        valueB = b.title.toLowerCase();
        break;
      case 'author':
        valueA = (a.author || '').toLowerCase();
        valueB = (b.author || '').toLowerCase();
        break;
      case 'created_at':
        valueA = new Date(a.created_at).getTime();
        valueB = new Date(b.created_at).getTime();
        break;
      case 'updated_at':
        valueA = new Date(a.updated_at).getTime();
        valueB = new Date(b.updated_at).getTime();
        break;
      default:
        valueA = new Date(a.created_at).getTime();
        valueB = new Date(b.created_at).getTime();
    }
    
    const compareResult = valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
    return sortOrder === 'asc' ? compareResult : -compareResult;
  });

  // 添加一个辅助函数
  const getLanguageDisplay = (code: string) => {
    // 语言代码映射
    const languageMap: Record<string, string> = {
      'zh': '中文',
      'zh-CN': '简体中文',
      'zh-TW': '繁体中文',
      'en': '英文',
      'en-US': '美式英文',
      'en-GB': '英式英文',
      'ja': '日文',
      'fr': '法文',
      'de': '德文',
      'es': '西班牙文',
      'ko': '韩文',
      'ru': '俄文'
    };
    
    return languageMap[code] || code;
  };

  const loadBookResources = async (bookId: string) => {
    if (resourcesLoaded || resourcesLoading) return;
    
    try {
      setResourcesLoading(true);
      const response = await fetch(`/api/books/${bookId}/resources`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (!response.ok) throw new Error('加载资源失败');
      
      const data = await response.json();
      setSelectedBook(prev => prev ? { ...prev, bookResources: data.resources } : null);
      setResourcesLoaded(true);
    } catch (error) {
      console.error('加载资源失败:', error);
      toast.error('加载资源失败');
    } finally {
      setResourcesLoading(false);
    }
  };

  return (
    <AdminLayout title="图书管理">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索书名、作者或用户"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <div className="flex flex-wrap gap-4">
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="语言" />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={toggleSortOrder}
              >
                <ChevronDown 
                  className={`h-4 w-4 transition-transform ${
                    sortOrder === 'desc' ? 'rotate-180' : ''
                  }`} 
                />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-muted-foreground">
            共 {totalBooks} 本书，第 {page} / {totalPages} 页
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadBooks(page > 1 ? page - 1 : 1)}
              disabled={page <= 1 || loading}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadBooks(page < totalPages ? page + 1 : totalPages)}
              disabled={page >= totalPages || loading}
            >
              下一页
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedBooks.map((book) => (
            <div
              key={book.id}
              className={`relative bg-card rounded-lg overflow-hidden transition-all duration-500 ${
                book.isDeleting ? 'opacity-50 blur-sm scale-95' : ''
              }`}
            >
              <Link href={`/content/${book.id}`} className="block p-4">
                <div className="flex gap-4">
                  <div className="relative w-24 h-32 bg-muted rounded">
                    {book.cover_url && (
                      <Image
                        src={book.cover_url}
                        alt={book.title}
                        fill
                        className="object-cover rounded"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium line-clamp-2">{book.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{book.author}</p>
                    
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span className="line-clamp-1">{book.user_email}</span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(book.created_at), 'yyyy/MM/dd', { locale: zhCN })}</span>
                      </div>
                      
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          <span>{book.stats?.chapter_count || 0} 章节</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>{book.stats?.total_block_count || 0} 语境块</span>
                        </div>
                      </div>
                      
                      {book.metadata?.language && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="w-3 h-3" />
                          <span>{getLanguageDisplay(book.metadata.language)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>

              <div className="absolute top-2 right-2 flex gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleViewDetails(book)}>
                      查看详情
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeleteBook(book)} className="text-destructive">
                      删除图书
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeleteBook(book, true)} className="text-destructive">
                      彻底删除（含资源）
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {book.isDeleting && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 图书详情对话框 */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedBook && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedBook.title}</DialogTitle>
                <DialogDescription>
                  {selectedBook.author} · 上传者: {selectedBook.user_email}
                </DialogDescription>
              </DialogHeader>
              
              <Tabs 
                defaultValue="info" 
                onValueChange={(value) => {
                  if (value === 'resources' && selectedBook && !resourcesLoaded && !resourcesLoading) {
                    loadBookResources(selectedBook.id);
                  }
                }}
              >
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="info">基本信息</TabsTrigger>
                  <TabsTrigger value="chapters">章节 ({selectedBook.stats?.chapter_count || 0})</TabsTrigger>
                  <TabsTrigger value="resources">
                    资源
                    {resourcesLoaded 
                      ? ` (${selectedBook.bookResources?.length || 0})` 
                      : ` (${selectedBook.resource_count || 0})`}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="info" className="space-y-4">
                  <div className="flex gap-6">
                    <div className="relative w-32 h-44 bg-muted rounded">
                      {selectedBook.cover_url && (
                        <Image
                          src={selectedBook.cover_url}
                          alt={selectedBook.title}
                          fill
                          className="object-cover rounded"
                        />
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">创建时间</h4>
                        <p>{format(new Date(selectedBook.created_at), 'yyyy年MM月dd日 HH:mm:ss', { locale: zhCN })}</p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">更新时间</h4>
                        <p>{format(new Date(selectedBook.updated_at), 'yyyy年MM月dd日 HH:mm:ss', { locale: zhCN })}</p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">用户ID</h4>
                        <p className="break-all">{selectedBook.user_id}</p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">图书ID</h4>
                        <p className="break-all">{selectedBook.id}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">元数据</h4>
                    <div className="bg-muted/50 p-4 rounded space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-muted-foreground">语言:</span>
                          <p>{selectedBook.metadata?.language ? getLanguageDisplay(selectedBook.metadata.language) : '未知'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">出版商:</span>
                          <p>{selectedBook.metadata?.publisher || '未知'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">出版日期:</span>
                          <p>{selectedBook.metadata?.published_date || '未知'}</p>
                        </div>
                      </div>
                      
                      {Object.entries(selectedBook.metadata || {})
                        .filter(([key]) => !['language', 'publisher', 'published_date'].includes(key))
                        .map(([key, value]) => (
                          <div key={key}>
                            <span className="text-xs text-muted-foreground">{key}:</span>
                            <p>{String(value)}</p>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">文件路径</h4>
                    <div className="bg-muted/50 p-4 rounded space-y-2">
                      <div>
                        <span className="text-xs text-muted-foreground">EPUB路径:</span>
                        <p className="break-all text-xs">{selectedBook.epub_path}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">音频路径:</span>
                        <p className="break-all text-xs">{selectedBook.audio_path || '无'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">语境块统计</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-primary/5 p-3 rounded">
                        <div className="font-medium">{selectedBook.stats?.chapter_count || 0}</div>
                        <div className="text-xs text-muted-foreground">章节</div>
                      </div>
                      <div className="bg-primary/5 p-3 rounded">
                        <div className="font-medium">{selectedBook.stats?.total_block_count || 0}</div>
                        <div className="text-xs text-muted-foreground">语境块总数</div>
                      </div>
                      <div className="bg-primary/5 p-3 rounded">
                        <div className="font-medium">{selectedBook.stats?.text_block_count || 0}</div>
                        <div className="text-xs text-muted-foreground">文本块</div>
                      </div>
                      <div className="bg-primary/5 p-3 rounded">
                        <div className="font-medium">{selectedBook.stats?.heading_block_count || 0}</div>
                        <div className="text-xs text-muted-foreground">标题块</div>
                      </div>
                      <div className="bg-primary/5 p-3 rounded">
                        <div className="font-medium">{selectedBook.stats?.image_block_count || 0}</div>
                        <div className="text-xs text-muted-foreground">图片块</div>
                      </div>
                      <div className="bg-primary/5 p-3 rounded">
                        <div className="font-medium">{selectedBook.stats?.audio_block_count || 0}</div>
                        <div className="text-xs text-muted-foreground">音频块</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="chapters">
                  <div className="bg-muted/50 rounded h-[400px] overflow-y-auto">
                    <div className="p-4 space-y-3">
                      {selectedBook.stats?.chapter_statistics ? (
                        selectedBook.stats.chapter_statistics
                          .sort((a, b) => a.order_index - b.order_index)
                          .map((chapterStat, index) => (
                            <div key={chapterStat.chapter_id} className="p-3 bg-card rounded space-y-2">
                              <div className="flex justify-between items-center">
                                <h3 className="font-medium flex items-center">
                                  <span className="text-muted-foreground text-sm mr-2">{index + 1}.</span>
                                  {chapterStat.chapter_title}
                                </h3>
                                <div className="flex items-center gap-2">
                                  {chapterStat.block_count > 0 && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                      {chapterStat.block_count} 个语境块
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">ID: {chapterStat.chapter_id.slice(0, 8)}...</span>
                                </div>
                              </div>
                              
                              {chapterStat.block_count > 0 && (
                                <div className="bg-muted/30 p-2 rounded">
                                  <div className="flex gap-4 text-xs">
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">文本:</span> 
                                      <span>{chapterStat.text_block_count}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">标题:</span>
                                      <span>{chapterStat.heading_block_count}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">图片:</span>
                                      <span>{chapterStat.image_block_count}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">音频:</span>
                                      <span>{chapterStat.audio_block_count}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">无章节信息</div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="resources">
                  <div className="bg-muted/50 rounded-md h-[400px] overflow-y-auto">
                    <div className="p-4">
                      {resourcesLoading ? (
                        <div className="flex flex-col justify-center items-center h-60 gap-3">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          <div className="text-sm text-muted-foreground">正在加载资源...</div>
                        </div>
                      ) : !resourcesLoaded ? (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4">资源尚未加载</p>
                          <Button 
                            variant="outline" 
                            onClick={() => loadBookResources(selectedBook!.id)}
                          >
                            点击加载资源
                          </Button>
                        </div>
                      ) : selectedBook?.bookResources && selectedBook.bookResources.length > 0 ? (
                        <>
                          {/* 资源统计信息 */}
                          <div className="mb-4">
                            <h3 className="text-sm font-medium">资源统计</h3>
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              <div className="bg-primary/5 p-2 rounded text-center">
                                <div className="font-medium">{selectedBook.bookResources.length}</div>
                                <div className="text-xs text-muted-foreground">总数</div>
                              </div>
                              <div className="bg-primary/5 p-2 rounded text-center">
                                <div className="font-medium">{selectedBook.bookResources.filter(r => r.resource_type === 'image').length}</div>
                                <div className="text-xs text-muted-foreground">图片</div>
                              </div>
                              <div className="bg-primary/5 p-2 rounded text-center">
                                <div className="font-medium">{selectedBook.bookResources.filter(r => r.resource_type === 'font').length}</div>
                                <div className="text-xs text-muted-foreground">字体</div>
                              </div>
                              <div className="bg-primary/5 p-2 rounded text-center">
                                <div className="font-medium">{selectedBook.bookResources.filter(r => r.resource_type === 'css' || r.resource_type === 'other').length}</div>
                                <div className="text-xs text-muted-foreground">其他</div>
                              </div>
                            </div>
                          </div>
                          
                          {/* 图片资源预览 */}
                          {selectedBook.bookResources.filter(r => r.resource_type === 'image').length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">图片资源</h4>
                              <ImageGallery resources={selectedBook.bookResources.filter(r => r.resource_type === 'image')} />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          无资源文件
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={() => setShowDetails(false)}>关闭</Button>
                <Button variant="default" asChild>
                  <Link href={`/content/${selectedBook.id}`}>查看阅读器</Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function ImageGallery({ resources }: { resources: any[] }) {
  const [displayCount, setDisplayCount] = useState(20);
  
  const loadMore = () => {
    setDisplayCount(prev => prev + 20);
  };
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {resources.slice(0, displayCount).map(resource => (
          <div 
            key={resource.id} 
            className="relative aspect-square bg-muted rounded overflow-hidden group cursor-pointer"
            onClick={() => {
              // 复制到剪贴板
              navigator.clipboard.writeText(resource.oss_path)
                .then(() => toast.success("OSS路径已复制到剪贴板"))
                .catch(() => toast.error("复制失败"));
              
              // 打开OSS链接
              window.open(resource.oss_path, '_blank');
            }}
          >
            <Image 
              src={resource.oss_path} 
              alt="" 
              fill
              className="object-cover group-hover:scale-105 transition-transform"
              unoptimized
            />
            {/* 悬浮效果 */}
            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-xs text-white">
              <div className="font-medium truncate mb-1">{resource.original_path.split('/').pop()}</div>
              <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[10px] text-gray-300">
                <div className="truncate">类型: {resource.resource_type}</div>
                <div className="truncate">格式: {resource.mime_type.split('/')[1] || resource.mime_type}</div>
                <div className="truncate">大小: {resource.metadata?.size ? `${(resource.metadata.size / 1024).toFixed(1)}KB` : '未知'}</div>
                <div className="truncate">日期: {format(new Date(resource.created_at), 'yyyy-MM-dd')}</div>
              </div>
              <div className="mt-1 text-center text-[10px] bg-blue-500/70 rounded py-0.5">
                点击查看和复制链接
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {displayCount < resources.length && (
        <div className="flex justify-center mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadMore}
            className="text-xs"
          >
            加载更多 ({Math.min(20, resources.length - displayCount)})
          </Button>
        </div>
      )}
    </div>
  );
} 