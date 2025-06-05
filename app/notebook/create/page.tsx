'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { UnauthorizedTip } from '@/components/auth/UnauthorizedTip';
import { ArrowLeft, BookOpen, Image, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';

interface CreateNotebookForm {
  title: string;
  description: string;
  cover_url: string;
}

export default function CreateNotebookPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CreateNotebookForm>({
    title: '',
    description: '',
    cover_url: ''
  });

  const [errors, setErrors] = useState<Partial<CreateNotebookForm>>({});

  const handleInputChange = (field: keyof CreateNotebookForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的错误信息
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CreateNotebookForm> = {};
    
    // 验证标题
    if (!form.title.trim()) {
      newErrors.title = '笔记本标题不能为空';
    } else if (form.title.length > 100) {
      newErrors.title = '标题不能超过100个字符';
    }

    // 验证描述
    if (form.description.length > 500) {
      newErrors.description = '描述不能超过500个字符';
    }

    // 验证图片URL
    if (form.cover_url.trim() && !isValidUrl(form.cover_url)) {
      newErrors.cover_url = '请输入有效的图片URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('请检查表单信息');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('正在创建笔记本...');

    try {
      // 获取当前用户的session token
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.access_token) {
        throw new Error('用户未登录');
      }

      const response = await fetch('/api/notebook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          cover_url: form.cover_url.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '创建笔记本失败');
      }

      toast.success(`笔记本《${form.title}》创建成功！`, {
        id: toastId,
        duration: 3000,
      });

      // 设置localStorage显示笔记本tab，然后跳转回语境库
      localStorage.setItem('context-library-active-tab', 'notebook');
      router.push('/context-library');

    } catch (error: any) {
      console.error('创建笔记本失败:', error);
      toast.error(error.message || '创建笔记本失败，请重试', {
        id: toastId,
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // 设置localStorage显示笔记本tab，然后跳转回语境库
    localStorage.setItem('context-library-active-tab', 'notebook');
    router.push('/context-library');
  };

  if (!user) {
    return <UnauthorizedTip />;
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-2xl mx-auto">
        {/* 页面头部 */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-300">
            创建新笔记本
          </h1>
        </div>

        {/* 创建表单 */}
        <div className="relative overflow-hidden rounded-xl p-[1px]">
          <span className="absolute inset-0 bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
          <div className="relative bg-black/80 backdrop-blur-md rounded-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 笔记本标题 */}
              <div className="space-y-2">
                <label htmlFor="title" className="flex items-center text-sm font-medium text-white">
                  <FileText className="w-4 h-4 mr-2 text-purple-400" />
                  笔记本标题 <span className="text-red-400 ml-1">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="输入笔记本标题..."
                  className={`w-full px-4 py-3 bg-black/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
                    errors.title 
                      ? 'border-red-500 focus:ring-red-500/20' 
                      : 'border-gray-600 focus:ring-purple-500/20 focus:border-purple-500'
                  }`}
                  maxLength={100}
                  disabled={loading}
                />
                {errors.title && (
                  <p className="text-red-400 text-xs mt-1">{errors.title}</p>
                )}
                <p className="text-gray-500 text-xs">
                  {form.title.length}/100 字符
                </p>
              </div>

              {/* 笔记本描述 */}
              <div className="space-y-2">
                <label htmlFor="description" className="flex items-center text-sm font-medium text-white">
                  <BookOpen className="w-4 h-4 mr-2 text-purple-400" />
                  笔记本描述 <span className="text-gray-500 ml-1">(可选)</span>
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="描述一下这个笔记本的用途或主题..."
                  rows={4}
                  className={`w-full px-4 py-3 bg-black/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors resize-none ${
                    errors.description 
                      ? 'border-red-500 focus:ring-red-500/20' 
                      : 'border-gray-600 focus:ring-purple-500/20 focus:border-purple-500'
                  }`}
                  maxLength={500}
                  disabled={loading}
                />
                {errors.description && (
                  <p className="text-red-400 text-xs mt-1">{errors.description}</p>
                )}
                <p className="text-gray-500 text-xs">
                  {form.description.length}/500 字符
                </p>
              </div>

              {/* 封面图片URL */}
              <div className="space-y-2">
                <label htmlFor="cover_url" className="flex items-center text-sm font-medium text-white">
                  <Image className="w-4 h-4 mr-2 text-purple-400" />
                  封面图片URL <span className="text-gray-500 ml-1">(可选)</span>
                </label>
                <input
                  id="cover_url"
                  type="url"
                  value={form.cover_url}
                  onChange={(e) => handleInputChange('cover_url', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className={`w-full px-4 py-3 bg-black/50 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
                    errors.cover_url 
                      ? 'border-red-500 focus:ring-red-500/20' 
                      : 'border-gray-600 focus:ring-purple-500/20 focus:border-purple-500'
                  }`}
                  disabled={loading}
                />
                {errors.cover_url && (
                  <p className="text-red-400 text-xs mt-1">{errors.cover_url}</p>
                )}
                <p className="text-gray-500 text-xs">
                  输入图片的完整URL地址，支持HTTPS链接
                </p>
              </div>

              {/* 图片预览 */}
              {form.cover_url && isValidUrl(form.cover_url) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    封面预览
                  </label>
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-black rounded-lg overflow-hidden border border-purple-500/20">
                    <img
                      src={form.cover_url}
                      alt="封面预览"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 提交按钮 */}
              <div className="flex items-center justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={loading}
                  className="text-gray-400 hover:text-white"
                >
                  取消
                </Button>
                
                <HoverBorderGradient
                  containerClassName="rounded-lg"
                  className="flex items-center gap-2 px-6 py-2"
                  as="button"
                  onClick={loading || !form.title.trim() ? undefined : handleSubmit}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>创建中...</span>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4" />
                      <span>创建笔记本</span>
                    </>
                  )}
                </HoverBorderGradient>
              </div>
            </form>
          </div>
        </div>

        {/* 使用提示 */}
        <div className="mt-6 p-4 bg-purple-950/30 border border-purple-500/20 rounded-lg">
          <h3 className="text-sm font-medium text-purple-300 mb-2">使用提示</h3>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• 笔记本创建后将是完全空白的，您可以在其中添加页面</li>
            <li>• 每个页面都可以包含文字、图片等丰富内容</li>
            <li>• 页面内容支持markdown格式，便于排版和整理</li>
            <li>• 可以为页面添加标签，方便分类和查找</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 