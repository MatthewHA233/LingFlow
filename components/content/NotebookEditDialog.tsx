'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Image as ImageIcon, FileText, Loader2, BookOpen, Edit, X, Check, Wand2, Sparkles, Cloud, CloudOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Book } from '@/types/book';

// 表单验证模式
const notebookFormSchema = z.object({
  title: z.string().min(1, "笔记本标题不能为空").max(100, "标题不能超过100个字符"),
  description: z.string().max(500, "描述不能超过500个字符").optional(),
  cover_url: z.string().optional(),
});

// 缓存的图片类型
interface CachedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  timestamp: number;
  isUploaded: boolean;
  uploadedUrl?: string;
}

// 服务器封面图片类型
interface ServerCoverImage {
  id: string;
  imageUrl: string;
  resource_id: string;
  uploaded_at: string;
  file_size: number;
}

// AI生成弹窗组件
interface AIGenerateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  notebookTitle: string;
  notebookDescription: string;
  onImageGenerated: (imageUrl: string, prompt: string) => void;
}

function AIGenerateDialog({ isOpen, onOpenChange, notebookTitle, notebookDescription, onImageGenerated }: AIGenerateDialogProps) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const getSuggestedPrompts = () => {
    const suggestions = [
      `${notebookTitle}相关的简洁封面设计`,
      `现代风格的${notebookTitle}主题图案`,
      `简约几何图形，体现${notebookTitle}主题`,
      `抽象艺术风格，适合${notebookTitle}`,
    ];
    
    if (notebookDescription) {
      suggestions.push(`${notebookDescription}相关的视觉元素`);
    }
    
    return suggestions;
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error('请输入图片描述');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('AI正在生成封面图片...', {
      duration: Infinity,
    });

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('用户未登录');
      }

      const response = await fetch('/api/llm/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          prompt: `创建一个笔记本封面：${aiPrompt}。风格现代简洁，适合作为数字笔记本封面。`,
          size: '896x1152',
          quality: 'standard',
          style: 'natural',
          outputFormat: 'webp',
          compression: 75,
          isVipModel: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI生成图片失败');
      }

      const imageData = await response.json();
      const imageUrl = `data:image/webp;base64,${imageData.image}`;
      
      onImageGenerated(imageUrl, aiPrompt);
      
      toast.success('AI封面生成成功！', {
        id: toastId,
        duration: 3000,
      });

      // 关闭弹窗并重置状态
      onOpenChange(false);
      setAiPrompt('');

    } catch (error: any) {
      console.error('AI生成图片失败:', error);
      toast.error(error.message || 'AI生成图片失败，请重试', {
        id: toastId,
        duration: 3000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border border-white/[0.2] shadow-purple-500/10 max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <Wand2 className="h-5 w-5 text-purple-400" />
            AI生成封面
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            描述你想要的封面，AI将为你生成专属设计
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-gray-300 text-sm block mb-2">描述想要的封面：</label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="例如：现代简约风格，包含书本和笔的元素，蓝色主题..."
              className="bg-black/40 border-white/10 focus:border-purple-500/50 text-white resize-none"
              rows={3}
              disabled={isGenerating}
            />
          </div>

          <div>
            <label className="text-gray-300 text-xs block mb-2">建议提示词：</label>
            <div className="flex flex-wrap gap-2">
              {getSuggestedPrompts().map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setAiPrompt(suggestion)}
                  className="text-xs bg-purple-950/30 text-purple-300 px-2 py-1 rounded-md hover:bg-purple-950/50 transition-colors"
                  disabled={isGenerating}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="bg-transparent border-purple-800/30 text-gray-300 hover:text-purple-400 hover:border-purple-600/50 hover:bg-purple-950/30"
            disabled={isGenerating}
          >
            取消
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!aiPrompt.trim() || isGenerating}
            className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                生成封面
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NotebookEditDialogProps {
  notebook: Book;
  resources: any[];
  resourcesLoading: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: any) => Promise<void>;
  isSaving: boolean;
}

export default function NotebookEditDialog({
  notebook,
  resources,
  resourcesLoading,
  isOpen,
  onOpenChange,
  onSave,
  isSaving
}: NotebookEditDialogProps) {
  // 表单定义
  const form = useForm({
    resolver: zodResolver(notebookFormSchema),
    defaultValues: {
      title: notebook?.title || '',
      description: notebook?.description || '',
      cover_url: notebook?.cover_url || '',
    }
  });

  // 状态管理
  const [selectedCover, setSelectedCover] = useState(notebook?.cover_url || '');
  const [editableFields, setEditableFields] = useState<Record<string, boolean>>({
    title: false,
    description: false,
    cover_url: false
  });
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // AI生成相关状态
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [cachedImages, setCachedImages] = useState<CachedImage[]>([]);
  const [serverCoverImages, setServerCoverImages] = useState<ServerCoverImage[]>([]);
  const [selectedGeneratedImage, setSelectedGeneratedImage] = useState<string | null>(null);
  const [uploadingImageIds, setUploadingImageIds] = useState<Set<string>>(new Set());

  // 缓存键
  const getCacheKey = () => `notebook_ai_images_${notebook?.id || 'global'}`;

  // 从服务器加载已上传的封面图片
  const loadServerCoverImages = async () => {
    if (!notebook?.id) return;
    
    try {
      const { data: coverResources, error } = await supabase
        .from('book_resources')
        .select('id, oss_path, metadata, created_at')
        .eq('book_id', notebook.id)
        .eq('resource_type', 'image');

      if (error) throw error;

      // 过滤metadata中purpose为cover的记录
      const coverImages: ServerCoverImage[] = (coverResources || [])
        .filter(resource => {
          try {
            const metadata = typeof resource.metadata === 'string' 
              ? JSON.parse(resource.metadata) 
              : resource.metadata;
            return metadata?.purpose === 'cover';
          } catch {
            return false;
          }
        })
        .map(resource => {
          const metadata = typeof resource.metadata === 'string' 
            ? JSON.parse(resource.metadata) 
            : resource.metadata;
          return {
            id: `server_${resource.id}`,
            imageUrl: resource.oss_path,
            resource_id: resource.id,
            uploaded_at: resource.created_at,
            file_size: metadata?.file_size || 0
          };
        })
        .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

      setServerCoverImages(coverImages);
    } catch (error) {
      console.error('加载服务器封面图片失败:', error);
    }
  };

  // 从本地存储加载缓存的图片
  const loadCachedImages = () => {
    try {
      const cacheKey = getCacheKey();
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const images: CachedImage[] = JSON.parse(cached);
        // 过滤掉超过7天的图片和已上传的图片
        const validImages = images.filter(img => 
          Date.now() - img.timestamp < 7 * 24 * 60 * 60 * 1000 && !img.isUploaded
        );
        setCachedImages(validImages);
        
        // 如果有过期或已上传图片，更新缓存
        if (validImages.length !== images.length) {
          localStorage.setItem(cacheKey, JSON.stringify(validImages));
        }
      }
    } catch (error) {
      console.error('加载缓存图片失败:', error);
    }
  };

  // 保存图片到本地缓存
  const saveCachedImage = (imageUrl: string, prompt: string): string => {
    try {
      const cacheKey = getCacheKey();
      const newImage: CachedImage = {
        id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        imageUrl,
        prompt,
        timestamp: Date.now(),
        isUploaded: false
      };
      
      const updatedImages = [newImage, ...cachedImages];
      setCachedImages(updatedImages);
      localStorage.setItem(cacheKey, JSON.stringify(updatedImages));
      
      return newImage.id;
    } catch (error) {
      console.error('保存缓存图片失败:', error);
      return '';
    }
  };

  // 从缓存中移除已上传的图片
  const removeUploadedImageFromCache = (imageId: string) => {
    try {
      const cacheKey = getCacheKey();
      const updatedImages = cachedImages.filter(img => img.id !== imageId);
      setCachedImages(updatedImages);
      localStorage.setItem(cacheKey, JSON.stringify(updatedImages));
    } catch (error) {
      console.error('移除缓存图片失败:', error);
    }
  };

  // 处理AI生成的图片
  const handleAIImageGenerated = (imageUrl: string, prompt: string) => {
    const imageId = saveCachedImage(imageUrl, prompt);
    setSelectedGeneratedImage(imageId);
    handleSelectCover(imageUrl);
    toast.success('图片已添加到画廊，可选择上传到服务器');
  };

  // 初始化原始值
  useEffect(() => {
    if (notebook) {
      setOriginalValues({
        title: notebook.title || '',
        description: notebook.description || '',
        cover_url: notebook.cover_url || ''
      });
    }
  }, [notebook]);

  // 监听notebook变化时重置表单和加载缓存
  useEffect(() => {
    if (notebook && isOpen) {
      form.reset({
        title: notebook.title,
        description: notebook.description || '',
        cover_url: notebook.cover_url || '',
      });
      
      setSelectedCover(notebook.cover_url || '');
      setEditableFields({
        title: false,
        description: false,
        cover_url: false
      });
      
      setSelectedGeneratedImage(null);
      
      // 加载图片
      loadCachedImages();
      loadServerCoverImages();
    }
  }, [notebook, isOpen, form]);

  // 切换字段的可编辑状态
  const toggleFieldEdit = (fieldName: string, forceState?: boolean) => {
    setEditableFields(prev => ({
      ...prev,
      [fieldName]: forceState !== undefined ? forceState : !prev[fieldName]
    }));
  };

  // 检查字段是否已更改
  const isFieldChanged = (fieldName: "title" | "description" | "cover_url") => {
    const currentValue = form.getValues(fieldName);
    return currentValue !== originalValues[fieldName];
  };

  // 选择封面
  const handleSelectCover = (url: string) => {
    setSelectedCover(url);
    form.setValue('cover_url', url);
  };

  // 处理图片上传
  const handleImageUpload = async (file: File) => {
    if (!file) return;

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('不支持的文件类型，请上传 JPG、PNG、WebP 或 GIF 格式的图片');
      return;
    }

    // 验证文件大小 (最大5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('文件大小不能超过5MB');
      return;
    }

    setUploadingImage(true);
    const toastId = toast.loading('正在上传图片...');

    try {
      // 创建预览
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      // 获取session token
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('用户未登录');
      }

      // 上传文件
      const formData = new FormData();
      formData.append('file', file);
      formData.append('notebookId', notebook.id);

      const response = await fetch('/api/notebooks/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '上传失败');
      }

      // 更新封面URL
      handleSelectCover(result.imageUrl);
      
      // 重新加载服务器图片
      await loadServerCoverImages();
      
      toast.success('图片上传成功！', {
        id: toastId,
        duration: 3000,
      });

      // 清理预览URL
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);

    } catch (error: any) {
      console.error('上传图片失败:', error);
      toast.error(error.message || '上传图片失败，请重试', {
        id: toastId,
        duration: 3000,
      });
      
      // 清理预览URL
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };

  // 上传AI生成的图片到服务器
  const handleUploadAIImage = async (cachedImage: CachedImage) => {
    if (!cachedImage.imageUrl.startsWith('data:image/')) {
      toast.error('无效的图片数据');
      return;
    }

    if (cachedImage.isUploaded) {
      // 如果已上传，直接设为封面
      handleSelectCover(cachedImage.uploadedUrl!);
      setSelectedGeneratedImage(cachedImage.id);
      toast.success('已设置为封面');
      return;
    }

    setUploadingImageIds(prev => new Set(prev).add(cachedImage.id));
    const toastId = toast.loading('正在上传AI生成的图片并设为封面...');

    try {
      // 获取session token
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('用户未登录');
      }

      // 将base64转换为Blob
      const response = await fetch(cachedImage.imageUrl);
      const blob = await response.blob();
      
      // 创建FormData
      const formData = new FormData();
      formData.append('file', blob, `ai-generated-cover-${Date.now()}.webp`);
      formData.append('notebookId', notebook.id);

      // 上传到服务器
      const uploadResponse = await fetch('/api/notebooks/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: formData,
      });

      const result = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(result.error || '上传失败');
      }

      // 从缓存中移除已上传的图片
      removeUploadedImageFromCache(cachedImage.id);
      
      // 重新加载服务器封面图片
      await loadServerCoverImages();
      
      // 设置为封面
      handleSelectCover(result.imageUrl);
      
      // 选择刚上传的服务器图片
      const newServerId = `server_${result.resourceId || Date.now()}`;
      setSelectedGeneratedImage(newServerId);
      
      toast.success('AI图片已上传并设为封面！', {
        id: toastId,
        duration: 3000,
      });

    } catch (error: any) {
      console.error('上传AI图片失败:', error);
      toast.error(error.message || '上传AI图片失败，请重试', {
        id: toastId,
        duration: 3000,
      });
    } finally {
      setUploadingImageIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(cachedImage.id);
        return newSet;
      });
    }
  };

  // 处理服务器封面图片点击
  const handleServerImageClick = (serverImage: ServerCoverImage) => {
    setSelectedGeneratedImage(serverImage.id);
    handleSelectCover(serverImage.imageUrl);
  };

  // 获取所有图片（缓存 + 服务器）
  const getAllImages = () => {
    const allImages: Array<{
      id: string;
      imageUrl: string;
      type: 'cached' | 'server';
      data: CachedImage | ServerCoverImage;
    }> = [];

    // 添加服务器图片（优先显示）
    serverCoverImages.forEach(serverImage => {
      allImages.push({
        id: serverImage.id,
        imageUrl: serverImage.imageUrl,
        type: 'server',
        data: serverImage
      });
    });

    // 添加缓存图片
    cachedImages.forEach(cachedImage => {
      allImages.push({
        id: cachedImage.id,
        imageUrl: cachedImage.imageUrl,
        type: 'cached',
        data: cachedImage
      });
    });

    return allImages;
  };

  // 提交表单
  const onSubmit = async (values: z.infer<typeof notebookFormSchema>) => {
    await onSave(values);
  };

  const allImages = getAllImages();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="bg-black border border-white/[0.2] shadow-purple-500/10 max-w-4xl max-h-[80vh] rounded-xl overflow-hidden p-4">
          <DialogHeader className="mb-3">
            <DialogTitle className="relative text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-300 pb-0.5">
              编辑笔记本
              <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500/70 via-purple-400 to-transparent"></div>
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 左侧：表单和画廊区域 */}
                <div className="space-y-3">
                  {/* 标题行：标题输入框 + 操作按钮 */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* 笔记本标题 - 左半部分 */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300 text-sm">标题</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field} 
                                className={`h-8 bg-black/40 border-white/10 focus:border-purple-500/50 text-white pr-8 text-sm
                                  ${!editableFields.title ? 'cursor-default' : ''}
                                  ${isFieldChanged('title') ? 'border-amber-500/40' : ''}
                                `}
                                readOnly={!editableFields.title}
                                onBlur={() => toggleFieldEdit('title', false)}
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {isFieldChanged('title') && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                )}
                                <button 
                                  type="button"
                                  onClick={() => toggleFieldEdit('title')}
                                  className="text-gray-400 hover:text-purple-500 transition-colors"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400 text-xs" />
                        </FormItem>
                      )}
                    />

                    {/* 操作按钮区域 - 右半部分 */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <label className="text-gray-300 text-sm">封面操作</label>
                        <div className="text-[10px] text-gray-500 text-right leading-tight">
                          <div>JPG、PNG、WebP、GIF</div>
                          <div>最大5MB</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* 上传图片按钮 */}
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file);
                            }}
                            className="hidden"
                            id="image-upload"
                            disabled={uploadingImage}
                          />
                          <label
                            htmlFor="image-upload"
                            className={`flex items-center justify-center gap-2 px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-md cursor-pointer hover:border-purple-500/50 transition-colors w-full ${
                              uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            {uploadingImage ? (
                              <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                            ) : (
                              <Upload className="h-3 w-3 text-purple-400" />
                            )}
                            <span className="text-gray-300">
                              {uploadingImage ? '上传中...' : '上传图片'}
                            </span>
                          </label>
                        </div>

                        {/* AI生成按钮 */}
                        <Button
                          type="button"
                          onClick={() => setShowAIDialog(true)}
                          size="sm"
                          className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-3 py-2 h-auto text-xs"
                        >
                          <Wand2 className="h-3 w-3 mr-1" />
                          AI生成
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* 笔记本描述 - 替换封面链接 */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">笔记本描述</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Textarea 
                              {...field} 
                              className={`bg-black/40 border-white/10 focus:border-purple-500/50 text-white pr-8 text-sm resize-none
                                ${!editableFields.description ? 'cursor-default' : ''}
                                ${isFieldChanged('description') ? 'border-amber-500/40' : ''}
                              `}
                              rows={2}
                              readOnly={!editableFields.description}
                              onBlur={() => toggleFieldEdit('description', false)}
                            />
                            <div className="absolute right-2 top-2 flex items-center gap-1">
                              {isFieldChanged('description') && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              )}
                              <button 
                                type="button"
                                onClick={() => toggleFieldEdit('description')}
                                className="text-gray-400 hover:text-purple-500 transition-colors"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* 封面链接 - 保留但移到描述下方 */}
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
                              className={`h-8 bg-black/40 border-white/10 focus:border-purple-500/50 text-white font-mono text-xs pr-8
                                ${!editableFields.cover_url ? 'cursor-default' : ''}
                                ${isFieldChanged('cover_url') ? 'border-amber-500/40' : ''}
                              `}
                              readOnly={!editableFields.cover_url}
                              onChange={(e) => {
                                field.onChange(e);
                                setSelectedCover(e.target.value);
                              }}
                              onBlur={() => toggleFieldEdit('cover_url', false)}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              {isFieldChanged('cover_url') && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              )}
                              <button 
                                type="button"
                                onClick={() => toggleFieldEdit('cover_url')}
                                className="text-gray-400 hover:text-purple-500 transition-colors"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* 图片画廊 - 移到左侧底部 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-gray-300 text-sm">
                        封面画廊 {allImages.length > 0 && (
                          <span className="text-purple-400">({allImages.length})</span>
                        )}
                      </label>
                      
                      {/* 选择信息和操作按钮 */}
                      {selectedGeneratedImage && (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const selectedImage = allImages.find(img => img.id === selectedGeneratedImage);
                            if (!selectedImage) return null;
                            
                            return (
                              <>
                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                  <span>#{allImages.findIndex(img => img.id === selectedGeneratedImage) + 1}</span>
                                  {selectedImage.type === 'server' && (
                                    <Cloud className="w-3 h-3 text-green-400" />
                                  )}
                                </div>
                                
                                {selectedImage.type === 'cached' ? (
                                  <Button
                                    onClick={() => handleUploadAIImage(selectedImage.data as CachedImage)}
                                    disabled={uploadingImageIds.has(selectedImage.id)}
                                    size="sm"
                                    className="h-6 px-2 text-xs bg-purple-600 hover:bg-purple-500 text-white"
                                  >
                                    {uploadingImageIds.has(selectedImage.id) ? (
                                      <Loader2 className="animate-spin h-3 w-3" />
                                    ) : (
                                      <>
                                        <Upload className="h-3 w-3 mr-1" />
                                        上传
                                      </>
                                    )}
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => {
                                      if (selectedImage.type === 'server') {
                                        handleServerImageClick(selectedImage.data as ServerCoverImage);
                                      }
                                    }}
                                    size="sm"
                                    className="h-6 px-2 text-xs bg-green-600 hover:bg-green-500 text-white"
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    设为封面
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    
                    {allImages.length > 0 ? (
                      <div className="h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
                        <div className="grid grid-cols-4 gap-2">
                          {allImages.map((item, index) => (
                            <div 
                              key={item.id} 
                              className={`
                                relative aspect-[3/4] bg-black/70 rounded-md overflow-hidden cursor-pointer
                                border transition-all duration-200
                                ${selectedGeneratedImage === item.id 
                                  ? 'border-purple-500 shadow-purple-500/20 shadow-md' 
                                  : 'border-white/10 hover:border-white/30'
                                }
                              `}
                              onClick={() => {
                                if (item.type === 'server') {
                                  handleServerImageClick(item.data as ServerCoverImage);
                                } else {
                                  setSelectedGeneratedImage(item.id);
                                  handleSelectCover(item.imageUrl);
                                }
                              }}
                            >
                              <Image
                                src={item.imageUrl}
                                alt={`封面 #${index + 1}`}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 25vw, 12vw"
                              />
                              
                              {/* 编号和状态指示 - 左上角 */}
                              <div className="absolute top-1 left-1 flex items-center gap-1">
                                <div className="bg-black/70 text-purple-300 text-[9px] px-1 py-0.5 rounded-sm">
                                  #{index + 1}
                                </div>
                                {item.type === 'server' && (
                                  <div className="bg-green-600 text-white rounded-full p-0.5" title="已上传到服务器">
                                    <Cloud className="w-2 h-2" />
                                  </div>
                                )}
                              </div>
                              
                              {/* 选择勾勾 - 右上角 */}
                              {selectedGeneratedImage === item.id && (
                                <div className="absolute top-1 right-1 bg-purple-500 text-white rounded-full p-0.5 shadow-md z-10">
                                  <Check className="w-2 h-2" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-40 rounded-lg border border-dashed border-white/20 bg-black/10 flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">暂无封面图片</p>
                          <p className="text-xs">上传图片或使用AI生成</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 右侧：当前封面预览 + 操作按钮 */}
                <div className="flex flex-col space-y-3">
                  <div className="flex-1">
                    <label className="text-gray-300 text-sm">当前封面</label>
                    
                    {(selectedCover || imagePreview) ? (
                      <div className="w-full max-w-[300px] mx-auto mt-2">
                        <div className="aspect-[3/4] rounded-lg border border-white/10 bg-black/20 overflow-hidden relative">
                          <Image
                            src={imagePreview || selectedCover}
                            alt="封面预览"
                            fill
                            className="object-cover"
                          />
                          {uploadingImage && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full max-w-[300px] mx-auto mt-2">
                        <div className="aspect-[3/4] rounded-lg border border-dashed border-white/20 bg-black/10 flex items-center justify-center">
                          <div className="text-center text-gray-500">
                            <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">暂无封面</p>
                            <p className="text-xs">选择或上传封面图片</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 操作按钮区域 - 移到右侧栏底部 */}
                  <div className="pt-0 border-t border-white/10">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => onOpenChange(false)}
                        className="flex-1 h-8 bg-transparent border-purple-800/30 text-gray-300 hover:text-purple-400 hover:border-purple-600/50 hover:bg-purple-950/30 transition-colors"
                      >
                        取消
                      </Button>
                      <Button 
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={isSaving || uploadingImage}
                        className="flex-1 h-8 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="animate-spin mr-2 h-3 w-3" />
                            保存中...
                          </>
                        ) : (
                          "保存更改"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </Form>

          {/* 移除原来的 DialogFooter */}
        </DialogContent>
      </Dialog>

      {/* AI生成弹窗 */}
      <AIGenerateDialog
        isOpen={showAIDialog}
        onOpenChange={setShowAIDialog}
        notebookTitle={form.getValues('title') || ''}
        notebookDescription={form.getValues('description') || ''}
        onImageGenerated={handleAIImageGenerated}
      />
    </>
  );
} 