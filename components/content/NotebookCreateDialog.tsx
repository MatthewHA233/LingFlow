'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Image as ImageIcon, FileText, Loader2, BookOpen, Edit, X, Check, Wand2, Sparkles, Cloud } from 'lucide-react';
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

// 表单验证模式
const notebookFormSchema = z.object({
  title: z.string().min(1, "笔记本标题不能为空").max(100, "标题不能超过100个字符"),
  description: z.string().max(500, "描述不能超过500个字符").optional(),
  cover_url: z.string().min(1, "请选择或上传一个封面图片"),
});

// 缓存的图片类型
interface CachedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  timestamp: number;
  isDefault?: boolean; // 标识是否为默认模板
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
      `${notebookTitle || '新笔记本'}相关的简洁封面设计`,
      `现代风格的${notebookTitle || '学习'}主题图案`,
      '简约几何图形，适合笔记本封面',
      '抽象艺术风格，知识主题',
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
  // 表单定义
  const form = useForm({
    resolver: zodResolver(notebookFormSchema),
    defaultValues: {
    title: '',
    description: '',
      cover_url: '',
    }
  });

  // 状态管理
  const [selectedCover, setSelectedCover] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  
  // AI生成相关状态
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [cachedImages, setCachedImages] = useState<CachedImage[]>([]);
  const [selectedGeneratedImage, setSelectedGeneratedImage] = useState<string | null>(null);

  // 缓存键（创建对话框使用全局缓存）
  const getCacheKey = () => 'notebook_create_ai_images';

  // 获取默认模板图片
  const getDefaultTemplates = (): CachedImage[] => {
    return [
      {
        id: 'default_cover1',
        imageUrl: '/default_cover/cover1.jpg',
        prompt: '默认模板 1',
        timestamp: Date.now(),
        isDefault: true
      },
      {
        id: 'default_cover2',
        imageUrl: '/default_cover/cover2.png',
        prompt: '默认模板 2',
        timestamp: Date.now(),
        isDefault: true
      },
      {
        id: 'default_cover3',
        imageUrl: '/default_cover/cover3.jpg',
        prompt: '默认模板 3',
        timestamp: Date.now(),
        isDefault: true
      }
    ];
  };

  // 从本地存储加载缓存的图片
  const loadCachedImages = () => {
    try {
      const cacheKey = getCacheKey();
      const cached = localStorage.getItem(cacheKey);
      let validImages: CachedImage[] = [];
      
      if (cached) {
        const images: CachedImage[] = JSON.parse(cached);
        // 过滤掉超过7天的图片（但保留默认模板）
        validImages = images.filter(img => 
          img.isDefault || (Date.now() - img.timestamp < 7 * 24 * 60 * 60 * 1000)
        );
        
        // 如果有过期图片，更新缓存
        if (validImages.length !== images.length) {
          localStorage.setItem(cacheKey, JSON.stringify(validImages));
        }
      }
      
      // 获取默认模板
      const defaultTemplates = getDefaultTemplates();
      
      // 检查是否已有默认模板，如果没有则添加
      const hasDefaults = validImages.some(img => img.isDefault);
      if (!hasDefaults) {
        validImages = [...defaultTemplates, ...validImages];
        localStorage.setItem(cacheKey, JSON.stringify(validImages));
      }
      
      setCachedImages(validImages);
    } catch (error) {
      console.error('加载缓存图片失败:', error);
      // 如果出错，至少加载默认模板
      const defaultTemplates = getDefaultTemplates();
      setCachedImages(defaultTemplates);
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
        timestamp: Date.now()
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

  // 处理AI生成的图片
  const handleAIImageGenerated = (imageUrl: string, prompt: string) => {
    const imageId = saveCachedImage(imageUrl, prompt);
    setSelectedGeneratedImage(imageId);
    handleSelectCover(imageUrl);
    toast.success('图片已添加到画廊');
  };

  // 初始化时加载缓存
  useEffect(() => {
    if (isOpen) {
      loadCachedImages();
    }
  }, [isOpen]);

  // 当缓存图片加载后，如果还没有选择封面，自动选择第一个默认模板
  useEffect(() => {
    if (cachedImages.length > 0 && !selectedCover) {
      const firstDefaultTemplate = cachedImages.find(img => img.isDefault);
      if (firstDefaultTemplate) {
        setSelectedGeneratedImage(firstDefaultTemplate.id);
        handleSelectCover(firstDefaultTemplate.imageUrl);
      }
    }
  }, [cachedImages, selectedCover]);

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

    try {
      // 创建预览
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      handleSelectCover(previewUrl);
      
      toast.success('图片已选择，将在创建时一起上传');

    } catch (error: any) {
      console.error('选择图片失败:', error);
      toast.error('选择图片失败，请重试');
      
      // 清理预览URL
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };

  // 提交表单
  const onSubmit = async (values: z.infer<typeof notebookFormSchema>) => {
    // 检查是否有封面
    if (!values.cover_url?.trim()) {
      toast.error('请选择或上传一个封面图片');
      return;
    }

    setCreating(true);
    const toastId = toast.loading('正在创建笔记本...', {
      duration: Infinity,
    });

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('用户未登录');
      }

      let finalCoverUrl = values.cover_url;

      // 如果有本地图片预览，需要先上传
      if (imagePreview && imagePreview.startsWith('blob:')) {
        const fileInput = document.getElementById('image-upload') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        
        if (file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('purpose', 'cover');

          const uploadResponse = await fetch('/api/upload/image', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
            },
            body: formData,
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResponse.ok) {
            throw new Error(uploadResult.error || '图片上传失败');
          }

          finalCoverUrl = uploadResult.imageUrl;
        }
      }

      // 创建笔记本
      const response = await fetch('/api/notebooks/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          title: values.title.trim(),
          description: values.description?.trim() || null,
          cover_url: finalCoverUrl || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '创建笔记本失败');
      }

      toast.success(`笔记本《${values.title}》创建成功！`, {
        id: toastId,
        duration: 3000,
      });

      // 重置表单和状态
      form.reset();
      setSelectedCover('');
      setSelectedGeneratedImage(null);
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);

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
      setCreating(false);
    }
  };

  // 重置对话框
  const resetDialog = () => {
    form.reset();
    setSelectedCover('');
    setSelectedGeneratedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
  };

  // 处理对话框关闭
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      setTimeout(() => {
        resetDialog();
      }, 300);
    }
    onOpenChange(open);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="bg-black border border-white/[0.2] shadow-purple-500/10 max-w-4xl max-h-[90vh] rounded-xl overflow-hidden p-4">
          <DialogHeader className="mb-3">
          <DialogTitle className="relative text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-300 pb-0.5">
            创建新笔记本
            <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500/70 via-purple-400 to-transparent"></div>
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
              创建一个新的笔记本来收录、组织自定义的习得语境
          </DialogDescription>
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
                          <FormLabel className="text-gray-300 text-sm">标题 <span className="text-red-400">*</span></FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-8 bg-black/40 border-white/10 focus:border-purple-500/50 text-white text-sm"
                              placeholder="输入笔记本标题..."
                              maxLength={100}
                            />
                          </FormControl>
                          <FormMessage className="text-red-400 text-xs" />
                        </FormItem>
                      )}
                    />

                    {/* 操作按钮区域 - 右半部分 */}
          <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <label className="text-gray-300 text-sm">封面操作 <span className="text-red-400">*</span></label>
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
                              {uploadingImage ? '选择中...' : '上传图片'}
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

          {/* 笔记本描述 */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">笔记本描述</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            className="bg-black/40 border-white/10 focus:border-purple-500/50 text-white text-sm resize-none"
                            rows={2}
                            placeholder="描述这个笔记本的用途..."
              maxLength={500}
                          />
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* 封面链接 */}
                  <FormField
                    control={form.control}
                    name="cover_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm">封面链接 <span className="text-red-400">*</span></FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-8 bg-black/40 border-white/10 focus:border-purple-500/50 text-white font-mono text-xs"
                            placeholder="或直接输入图片链接..."
                            onChange={(e) => {
                              field.onChange(e);
                              setSelectedCover(e.target.value);
                            }}
                          />
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* 图片画廊 */}
          <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-gray-300 text-sm">
                        封面画廊 {cachedImages.length > 0 && (
                          <span className="text-purple-400">
                            ({cachedImages.filter(img => img.isDefault).length}个模板 + {cachedImages.filter(img => !img.isDefault).length}个生成)
                          </span>
                        )}
            </label>
                      
                      {/* 选择信息 */}
                      {selectedGeneratedImage && (
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            {(() => {
                              const selectedItem = cachedImages.find(img => img.id === selectedGeneratedImage);
                              return selectedItem?.isDefault ? (
                                <span className="text-amber-400">模板</span>
                              ) : (
                                <span>#{cachedImages.findIndex(img => img.id === selectedGeneratedImage) + 1}</span>
                              );
                            })()}
                          </div>
                        </div>
            )}
          </div>

                    {cachedImages.length > 0 ? (
                      <div className="h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
                        <div className="grid grid-cols-4 gap-2">
                          {cachedImages.map((item, index) => (
                            <div 
                              key={item.id} 
                              className={`
                                relative aspect-[3/4] bg-black/70 rounded-md overflow-hidden cursor-pointer
                                border transition-all duration-200
                                ${selectedGeneratedImage === item.id 
                                  ? 'border-purple-500 shadow-purple-500/20 shadow-md' 
                                  : item.isDefault 
                                    ? 'border-amber-400/30 hover:border-amber-400/60'
                                    : 'border-white/10 hover:border-white/30'
                                }
                              `}
                              onClick={() => {
                                setSelectedGeneratedImage(item.id);
                                handleSelectCover(item.imageUrl);
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
                                <div className={`text-[9px] px-1 py-0.5 rounded-sm ${
                                  item.isDefault 
                                    ? 'bg-amber-600/70 text-amber-100' 
                                    : 'bg-black/70 text-purple-300'
                                }`}>
                                  {item.isDefault ? '模板' : `#${index + 1}`}
                                </div>
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
                          <p className="text-sm">加载模板中...</p>
                          <p className="text-xs">请稍候或刷新页面</p>
              </div>
            </div>
          )}
                  </div>
                </div>

                {/* 右侧：当前封面预览 + 操作按钮 */}
                <div className="flex flex-col space-y-3">
                  <div className="flex-1">
                    <label className="text-gray-300 text-sm">封面预览</label>
                    
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
                            <p className="text-sm">封面必填</p>
                            <p className="text-xs">请选择或上传封面图片</p>
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
                        disabled={creating || uploadingImage || !form.getValues('title').trim() || !form.getValues('cover_url').trim()}
                        className="flex-1 h-8 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="animate-spin mr-2 h-3 w-3" />
                  创建中...
                </>
              ) : (
                <>
                            <BookOpen className="mr-2 h-3 w-3" />
                  创建笔记本
                </>
              )}
            </Button>
                    </div>
                  </div>
                </div>
          </div>
        </form>
          </Form>
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