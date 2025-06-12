'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Image, FileText, Loader2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CreateNotebookForm {
  title: string;
  description: string;
  cover_url: string;
}

interface NotebookCreateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function NotebookCreateDialog({ 
  isOpen, 
  onOpenChange, 
  onSuccess 
}: NotebookCreateDialogProps) {
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

      const response = await fetch('/api/books/create-notebook', {
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

      // 重置表单
      setForm({
        title: '',
        description: '',
        cover_url: ''
      });
      setErrors({});

      // 关闭对话框
      onOpenChange(false);

      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      }

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
    // 重置表单
    setForm({
      title: '',
      description: '',
      cover_url: ''
    });
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border border-white/[0.2] shadow-purple-500/10 max-w-lg rounded-xl overflow-hidden">
        <DialogHeader className="mb-4">
          <DialogTitle className="relative text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-300 pb-0.5">
            创建新笔记本
            <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500/70 via-purple-400 to-transparent"></div>
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            创建一个新的笔记本来组织你的想法和内容
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              rows={3}
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
            
            <Button
              type="submit"
              disabled={loading || !form.title.trim()}
              className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  创建中...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4 mr-2" />
                  创建笔记本
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 