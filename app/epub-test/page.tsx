// app/epub-test/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ePub from 'epubjs';
import { FileUpload } from '@/components/ui/file-upload';
import { Loader2, FileText, Check, X, AlertCircle, BookOpen, Code } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function EpubTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [spineItems, setSpineItems] = useState<any[]>([]);
  const [manifestItems, setManifestItems] = useState<any[]>([]);
  const [anchorPaths, setAnchorPaths] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [itemContent, setItemContent] = useState<string>('');
  const [bookMetadata, setBookMetadata] = useState<any>(null);
  const [failedItems, setFailedItems] = useState<string[]>([]);
  const [successItems, setSuccessItems] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleFile = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setFile(file);
    setLog([]);
    setSpineItems([]);
    setFailedItems([]);
    setSuccessItems([]);
    setManifestItems([]);
    setAnchorPaths([]);
    setSelectedItem('');
    setItemContent('');
    setLoading(true);
    
    try {
      addLog(`开始处理文件: ${file.name}`);
      
      // 读取文件
      const arrayBuffer = await file.arrayBuffer();
      addLog('文件读取完成');
      
      // 初始化EPUB
      const book = ePub(arrayBuffer);
      await book.ready;
      setBook(book);
      addLog('EPUB解析器初始化完成');
      
      // 获取元数据
      const metadata = await book.loaded.metadata;
      setBookMetadata(metadata);
      addLog(`书籍信息: ${metadata.title} by ${metadata.creator}`);
      
      // 获取manifest资源清单
      if (book.packaging && book.packaging.manifest) {
        const manifestEntries = Object.entries(book.packaging.manifest).map(([id, item]) => ({
          id,
          ...item
        }));
        setManifestItems(manifestEntries);
        addLog(`找到 ${manifestEntries.length} 个资源项`);
      }
      
      // 获取spine项
      if (book.spine && (book.spine as any).items) {
        const items = Array.from((book.spine as any).items);
        setSpineItems(items);
        addLog(`找到 ${items.length} 个spine项`);
        
        // 收集带锚点的路径
        const anchors = items
          .filter((item: any) => item.href && item.href.includes('#'))
          .map((item: any) => {
            const [path, anchor] = item.href.split('#');
            return {
              href: item.href,
              path,
              anchor,
              label: item.label || '',
              idref: item.idref || '',
            };
          });
        
        if (anchors.length > 0) {
          setAnchorPaths(anchors);
          addLog(`发现 ${anchors.length} 个带锚点的引用`);
        } else {
          addLog('没有发现带锚点的引用');
        }
        
        // 测试每个spine项
        for (let i = 0; i < items.length; i++) {
          const item = items[i] as any;
          const href = item.href;
          
          addLog(`测试章节 #${i+1}: ${href}`);
          
          // 首先尝试直接加载
          try {
            const content = await book.load(href);
            if (content) {
              addLog(`✅ 成功加载: ${href}`);
              successItems.push(href);
              continue;
            }
          } catch (e) {
            // 如果直接加载失败，尝试不同的变体
          }
          
          // 如果包含锚点，尝试去除锚点
          if (href.includes('#')) {
            const baseHref = href.split('#')[0];
            try {
              const content = await book.load(baseHref);
              if (content) {
                addLog(`✅ 成功加载(移除锚点): ${baseHref}`);
                successItems.push(href);
                continue;
              }
            } catch (e) {
              // 尝试其他变体
            }
          }
          
          // 尝试其他路径变体
          const fileName = href.split('/').pop() || '';
          const pathVariants = [
            href.replace(/^\//, ''),          // 移除开头的斜杠
            `xhtml/${fileName}`,              // 尝试xhtml目录
            `OEBPS/${fileName}`,              // 尝试OEBPS目录
            fileName                          // 仅尝试文件名
          ];
          
          let loaded = false;
          for (const path of pathVariants) {
            try {
              const content = await book.load(path);
              if (content) {
                addLog(`✅ 成功加载(变体): ${path}`);
                successItems.push(href);
                loaded = true;
                break;
              }
            } catch (e) {
              // 继续尝试下一个变体
            }
          }
          
          if (!loaded) {
            addLog(`❌ 无法加载: ${href}`);
            failedItems.push(href);
          }
        }
      } else {
        addLog('⚠️ 未找到spine结构');
      }
      
    } catch (error) {
      addLog(`❌ 解析出错: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 改进资源加载方法
  const loadContent = async (href: string) => {
    if (!book) return;
    
    setSelectedItem(href);
    setItemContent(`正在尝试加载: ${href}...`);
    addLog(`开始加载资源: ${href}`);
    
    try {
      // 尝试相对路径变体
      const pathVariants = [
        href,                       // 原始路径
        href.replace(/^\//, ''),    // 去除开头斜杠
        `/${href}`,                 // 添加开头斜杠
        href.split('/').pop() || '' // 仅文件名
      ];
      
      // 对于所有类型资源，首先尝试获取资源URL
      for (const path of pathVariants) {
        try {
          // 尝试获取资源URL (主要用于图片)
          const url = book.resources.url(path);
          if (url) {
            const extension = path.split('.').pop()?.toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension || '');
            
            if (isImage) {
              addLog(`成功获取图片URL: ${url}`);
              setItemContent(`<img src="${url}" alt="${path}" style="max-width: 100%;" />`);
              return;
            }
          }
        } catch (e) {
          // 继续尝试下一个方法
        }
        
        // 尝试直接获取资源内容
        try {
          addLog(`尝试直接获取资源: ${path}`);
          const content = await book.resources.get(path);
          if (content) {
            addLog(`成功获取资源内容类型: ${typeof content}`);
            
            // 处理不同类型的内容
            if (typeof content === 'string') {
              setItemContent(content);
            } else if (content instanceof Blob) {
              const url = URL.createObjectURL(content);
              setItemContent(`<img src="${url}" alt="${path}" style="max-width: 100%;" />`);
            } else if (content instanceof ArrayBuffer) {
              setItemContent(`<pre>二进制内容 (长度: ${content.byteLength}字节)</pre>`);
            } else if (content instanceof Document) {
              setItemContent(new XMLSerializer().serializeToString(content));
            } else {
              setItemContent(JSON.stringify(content, null, 2));
            }
            return;
          }
        } catch (e) {
          // 继续尝试下一个方法
        }
        
        // 对于HTML内容，尝试使用Section.load
        try {
          addLog(`尝试使用book.load: ${path}`);
          const content = await book.load(path);
          if (content) {
            addLog(`成功使用book.load加载内容: ${typeof content}`);
            const htmlContent = content instanceof Document 
              ? new XMLSerializer().serializeToString(content) 
              : String(content);
            
            setItemContent(htmlContent);
            return;
          }
        } catch (e) {
          // 继续尝试下一个路径
          addLog(`book.load失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      
      // 所有尝试都失败
      addLog(`❌ 无法加载资源: ${href}`);
      setItemContent(`无法加载内容: ${href}。可能是由于EPUB.js库的限制，无法直接访问此类型的资源。`);
      
    } catch (error) {
      addLog(`❌ 加载过程中出错: ${error instanceof Error ? error.message : String(error)}`);
      setItemContent(`加载出错: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // 修复导出功能，确保正确获取内容
  const exportAllResources = async () => {
    if (!book) return;
    
    setLoading(true);
    addLog(`开始导出所有资源...`);
    
    try {
      const zip = new JSZip();
      
      // 记录已处理的文件，避免重复
      const processedFiles = new Set<string>();
      
      // 创建基本目录结构
      zip.folder("META-INF");
      
      // 添加container.xml
      zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
      
      // 修改：预先收集并创建所有必要的目录
      const allDirs = new Set<string>();
      
      // 从spine和manifest收集目录
      [...spineItems, ...manifestItems].forEach(item => {
        const href = item.href;
        if (href && href.includes('/')) {
          const dir = href.substring(0, href.lastIndexOf('/'));
          allDirs.add(dir);
          
          // 添加所有父目录
          let parentDir = dir;
          while (parentDir.includes('/')) {
            parentDir = parentDir.substring(0, parentDir.lastIndexOf('/'));
            allDirs.add(parentDir);
          }
        }
      });
      
      // 创建所有目录
      addLog(`创建目录结构...`);
      allDirs.forEach(dir => {
        zip.folder(dir);
        addLog(`✓ 创建目录: ${dir}`);
      });
      
      // 1. 导出章节文件
      addLog(`开始导出章节文件...`);
      for (const item of spineItems) {
        const href = item.href;
        if (!href || processedFiles.has(href)) continue;
        
        try {
          // 不需要再次创建目录，因为已经预先创建了
          
          // 获取内容
          let content = null;
          try {
            // 检查是否需要特殊处理xhtml文件
            if (href.includes('xhtml/') || href.endsWith('.xhtml')) {
              addLog(`特殊处理xhtml文件: ${href}`);
              // 尝试通过section加载
              try {
                const index = spineItems.findIndex(i => i.href === href);
                if (index >= 0) {
                  const section = book.spine.get(index);
                  if (section) {
                    const sectionContent = await section.load(book.load.bind(book));
                    if (sectionContent) {
                      addLog(`✅ 通过section成功加载: ${href}`);
                      
                      // 处理HTMLElement类型
                      if (sectionContent.nodeType === 1) { // Element节点类型
                        content = sectionContent.outerHTML || new XMLSerializer().serializeToString(sectionContent);
                        addLog(`处理为HTMLElement (${content.length}字节)`);
                      } else if (sectionContent instanceof Document) {
                        content = new XMLSerializer().serializeToString(sectionContent);
                        addLog(`处理为Document (${content.length}字节)`);
                      } else if (typeof sectionContent === 'string') {
                        content = sectionContent;
                        addLog(`处理为字符串 (${content.length}字节)`);
                      } else {
                        // 尝试其他类型处理
                        if (sectionContent.toString && sectionContent.toString() !== '[object Object]') {
                          content = sectionContent.toString();
                        } else if (sectionContent.innerHTML) {
                          content = sectionContent.innerHTML;
                        } else {
                          // 最后的尝试：强制转换为字符串
                          try {
                            content = new XMLSerializer().serializeToString(sectionContent);
                          } catch (e) {
                            content = String(sectionContent);
                          }
                        }
                        addLog(`处理为其他类型 (${content ? content.length : 0}字节)`);
                      }
                    }
                  }
                }
              } catch (e) {
                addLog(`⚠️ 特殊处理失败: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
            
            // 如果特殊处理失败，尝试常规方法
            if (!content) {
              content = await book.resources.get(href);
            }
          } catch (e) {
            // 如果失败，尝试使用book.load
            try {
              content = await book.load(href);
            } catch (e) {
              // 继续尝试下一个方法
            }
          }
          
          if (content) {
            // 根据内容类型处理
            if (typeof content === 'string') {
              // 添加详细日志用于调试
              addLog(`✏️ 写入文本文件: ${href} (${content.length}字节)`);
              zip.file(href, content);
            } else if (content instanceof Blob) {
              const arrayBuffer = await content.arrayBuffer();
              addLog(`✏️ 写入二进制文件: ${href} (${arrayBuffer.byteLength}字节)`);
              zip.file(href, arrayBuffer);
            } else if (content instanceof ArrayBuffer) {
              addLog(`✏️ 写入二进制文件: ${href} (${content.byteLength}字节)`);
              zip.file(href, content);
            } else if (content instanceof Document) {
              const serialized = new XMLSerializer().serializeToString(content);
              addLog(`✏️ 写入文档文件: ${href} (${serialized.length}字节)`);
              zip.file(href, serialized);
            } else if (content.nodeType === 9) { // Document node type
              const serialized = new XMLSerializer().serializeToString(content);
              addLog(`✏️ 写入文档文件: ${href} (${serialized.length}字节)`);
              zip.file(href, serialized);
            } else if (typeof content === 'object') {
              try {
                const jsonContent = JSON.stringify(content, null, 2);
                addLog(`✏️ 写入JSON文件: ${href} (${jsonContent.length}字节)`);
                zip.file(href, jsonContent);
              } catch (e) {
                const strContent = String(content);
                addLog(`✏️ 写入字符串文件: ${href} (${strContent.length}字节)`);
                zip.file(href, strContent);
              }
            } else {
              const strContent = String(content);
              addLog(`✏️ 写入字符串文件: ${href} (${strContent.length}字节)`);
              zip.file(href, strContent);
            }
            
            processedFiles.add(href);
            addLog(`✅ 已导出章节文件: ${href}`);
          } else {
            // 尝试获取图片等资源
            const extension = href.split('.').pop()?.toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension || '');
            
            if (isImage) {
              try {
                const url = book.resources.url(href);
                if (url && url.startsWith('blob:')) {
                  const response = await fetch(url);
                  const blob = await response.blob();
                  const arrayBuffer = await blob.arrayBuffer();
                  addLog(`✏️ 写入图片文件: ${href} (${arrayBuffer.byteLength}字节)`);
                  zip.file(href, arrayBuffer);
                  processedFiles.add(href);
                  addLog(`✅ 已导出图片文件: ${href}`);
                }
              } catch (e) {
                addLog(`⚠️ 无法获取图片: ${href}`);
              }
            } else {
              addLog(`⚠️ 无法获取内容: ${href}`);
            }
          }
        } catch (e) {
          addLog(`⚠️ 导出章节失败 ${href}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      
      // 2. 导出manifest项
      addLog(`开始导出资源文件...`);
      for (const item of manifestItems) {
        const href = item.href;
        if (!href || processedFiles.has(href)) continue;
        
        try {
          // 创建所需的文件夹
          if (href.includes('/')) {
            const dir = href.substring(0, href.lastIndexOf('/'));
            zip.folder(dir);
          }
          
          // 尝试获取真实内容
          let content = null;
          let success = false;
          
          // 首先尝试从resources对象获取
          try {
            content = await book.resources.get(href);
            if (content) {
              if (content instanceof Blob) {
                const arrayBuffer = await content.arrayBuffer();
                zip.file(href, arrayBuffer);
                success = true;
              } else if (content instanceof ArrayBuffer) {
                zip.file(href, content);
                success = true;
              } else if (typeof content === 'string') {
                // 检查内容是否为blob URL
                if (content.startsWith('blob:')) {
                  try {
                    const response = await fetch(content);
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    zip.file(href, arrayBuffer);
                    success = true;
                  } catch (e) {
                    // 如果获取blob失败，尝试保存原始字符串
                    zip.file(href, content);
                    success = true;
                  }
                } else {
                  zip.file(href, content);
                  success = true;
                }
              } else if (content instanceof Document) {
                const serialized = new XMLSerializer().serializeToString(content);
                zip.file(href, serialized);
                success = true;
              } else {
                // 尝试转换为JSON或字符串
                try {
                  zip.file(href, JSON.stringify(content, null, 2));
                  success = true;
                } catch (e) {
                  zip.file(href, String(content));
                  success = true;
                }
              }
            }
          } catch (e) {
            // 如果resources获取失败，尝试URL方法
          }
          
          // 如果resources获取失败，尝试获取URL
          if (!success) {
            try {
              const url = book.resources.url(href);
              if (url && url.startsWith('blob:')) {
                const response = await fetch(url);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                zip.file(href, arrayBuffer);
                success = true;
              }
            } catch (e) {
              // 继续尝试其他方式
            }
          }
          
          if (success) {
            processedFiles.add(href);
            addLog(`✅ 已导出资源: ${href}`);
          } else {
            addLog(`⚠️ 无法获取资源: ${href}`);
          }
        } catch (e) {
          addLog(`⚠️ 导出资源失败 ${href}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      
      // 3. 添加内容清单文件
      addLog(`创建内容清单...`);
      const contentList = Array.from(processedFiles).map(file => file);
      zip.file("exported_files_list.txt", contentList.join('\n'));
      
      // 4. 导出完成后，在生成zip前检查文件
      addLog(`正在检查已添加的文件...`);
      let fileCount = 0;
      Object.keys(zip.files).forEach(path => {
        if (!zip.files[path].dir) {
          fileCount++;
          addLog(`已添加文件: ${path}`);
        }
      });
      addLog(`共添加 ${fileCount} 个文件到ZIP`);
      
      // 5. 生成并下载ZIP文件
      addLog(`生成ZIP文件...`);
      const content = await zip.generateAsync({type: 'blob'});
      saveAs(content, `${file?.name || 'epub-export'}.zip`);
      addLog(`✅ 导出完成！文件已下载`);
      
    } catch (error) {
      addLog(`❌ 导出过程中出错: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">EPUB解析测试</h1>
        
        {!loading && book && (
          <Button 
            onClick={exportAllResources} 
            variant="default"
            className="flex items-center gap-2"
            disabled={loading || !book}
          >
            <FileText className="h-4 w-4" /> 一键导出所有资源
          </Button>
        )}
      </div>
      
      <div className="grid gap-6">
        {!loading && !book && (
          <Card>
            <CardHeader>
              <CardTitle>选择EPUB文件</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload onChange={handleFile} />
            </CardContent>
          </Card>
        )}
        
        {loading && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                正在处理...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={50} className="mb-4" />
              <div className="bg-muted p-4 rounded-md h-64 overflow-auto">
                {log.map((line, i) => (
                  <div key={i} className="text-sm font-mono mb-1">{line}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {!loading && book && (
          <Tabs defaultValue="overview">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="spine">章节列表</TabsTrigger>
              <TabsTrigger value="manifest">资源清单</TabsTrigger>
              <TabsTrigger value="anchors">锚点分析</TabsTrigger>
              <TabsTrigger value="content">内容预览</TabsTrigger>
              <TabsTrigger value="logs">处理日志</TabsTrigger>
            </TabsList>
          
            {/* 概览选项卡 */}
            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>解析结果统计</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-md">
                      <div className="text-4xl font-bold mb-2 text-green-500">{successItems.length}</div>
                      <div className="text-sm">成功加载的章节</div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-md">
                      <div className="text-4xl font-bold mb-2 text-red-500">{failedItems.length}</div>
                      <div className="text-sm">加载失败的章节</div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-md">
                      <div className="text-4xl font-bold mb-2 text-blue-500">{manifestItems.length}</div>
                      <div className="text-sm">资源文件数</div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-md">
                      <div className="text-4xl font-bold mb-2 text-yellow-500">{anchorPaths.length}</div>
                      <div className="text-sm">带锚点引用数</div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-3">书籍信息</h3>
                    {bookMetadata && (
                      <div className="bg-muted p-4 rounded-md">
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">标题</dt>
                            <dd className="text-base">{bookMetadata.title}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">作者</dt>
                            <dd className="text-base">{bookMetadata.creator}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">出版商</dt>
                            <dd className="text-base">{bookMetadata.publisher || '未知'}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">语言</dt>
                            <dd className="text-base">{bookMetadata.language || '未知'}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">发布日期</dt>
                            <dd className="text-base">{bookMetadata.pubdate || '未知'}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">修改日期</dt>
                            <dd className="text-base">{bookMetadata.modified_date || '未知'}</dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>

                  {failedItems.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium mb-3">加载失败项</h3>
                      <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <div className="flex items-center mb-2">
                          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                          <h3 className="font-medium">以下章节无法加载</h3>
                        </div>
                        <ul className="list-disc pl-5 space-y-1">
                          {failedItems.map((item, i) => (
                            <li key={i} className="text-sm font-mono">{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* 章节列表选项卡 */}
            <TabsContent value="spine">
              <Card>
                <CardHeader>
                  <CardTitle>书籍章节结构</CardTitle>
                  <CardDescription>Spine项定义了章节阅读顺序</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-md">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">#</th>
                          <th className="text-left p-2 font-medium">标题</th>
                          <th className="text-left p-2 font-medium">文件路径</th>
                          <th className="text-left p-2 font-medium">ID引用</th>
                          <th className="text-center p-2 font-medium">状态</th>
                          <th className="text-right p-2 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spineItems.map((item, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{i+1}</td>
                            <td className="p-2">{item.label || '(无标题)'}</td>
                            <td className="p-2 font-mono text-xs">{item.href}</td>
                            <td className="p-2 font-mono text-xs">{item.idref}</td>
                            <td className="p-2 text-center">
                              {successItems.includes(item.href) ? (
                                <Check className="h-4 w-4 text-green-500 inline" />
                              ) : (
                                <X className="h-4 w-4 text-red-500 inline" />
                              )}
                            </td>
                            <td className="p-2 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadContent(item.href)}
                              >
                                查看
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* 资源清单选项卡 */}
            <TabsContent value="manifest">
              <Card>
                <CardHeader>
                  <CardTitle>资源清单</CardTitle>
                  <CardDescription>所有包含在EPUB中的文件</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-md overflow-auto max-h-[500px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">ID</th>
                          <th className="text-left p-2 font-medium">路径</th>
                          <th className="text-left p-2 font-medium">Media Type</th>
                          <th className="text-right p-2 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manifestItems.map((item, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2 font-mono text-xs">{item.id}</td>
                            <td className="p-2 font-mono text-xs">{item.href}</td>
                            <td className="p-2 font-mono text-xs">{item['media-type']}</td>
                            <td className="p-2 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadContent(item.href)}
                              >
                                查看
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* 锚点分析选项卡 */}
            <TabsContent value="anchors">
              <Card>
                <CardHeader>
                  <CardTitle>锚点路径分析</CardTitle>
                  <CardDescription>带有锚点(#)的引用分析</CardDescription>
                </CardHeader>
                <CardContent>
                  {anchorPaths.length > 0 ? (
                    <div className="bg-muted p-4 rounded-md overflow-auto max-h-[500px]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-medium">#</th>
                            <th className="text-left p-2 font-medium">完整路径</th>
                            <th className="text-left p-2 font-medium">基本路径</th>
                            <th className="text-left p-2 font-medium">锚点</th>
                            <th className="text-left p-2 font-medium">标题</th>
                            <th className="text-right p-2 font-medium">加载状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {anchorPaths.map((item, i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2">{i+1}</td>
                              <td className="p-2 font-mono text-xs">{item.href}</td>
                              <td className="p-2 font-mono text-xs">{item.path}</td>
                              <td className="p-2 font-mono text-xs">{item.anchor}</td>
                              <td className="p-2">{item.label || '(无标题)'}</td>
                              <td className="p-2 text-right">
                                {successItems.includes(item.href) ? (
                                  <span className="text-green-500">可加载</span>
                                ) : (
                                  <span className="text-red-500">无法加载</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 text-center">
                      <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
                      <h3 className="font-medium mb-2">没有检测到锚点</h3>
                      <p className="text-muted-foreground">
                        此EPUB文件中没有使用锚点引用，所有路径都是直接文件引用。
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* 内容预览选项卡 */}
            <TabsContent value="content">
              <Card>
                <CardHeader>
                  <CardTitle>内容预览</CardTitle>
                  <CardDescription>
                    {selectedItem ? `预览: ${selectedItem}` : '从章节列表或资源清单中选择一个项目查看'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedItem ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium mb-2 flex items-center">
                          <BookOpen className="h-4 w-4 mr-1" /> 渲染预览
                        </h3>
                        <div 
                          className="bg-white p-4 rounded border overflow-auto max-h-[600px] epub-content-preview"
                          dangerouslySetInnerHTML={{ __html: itemContent }}
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium mb-2 flex items-center">
                          <Code className="h-4 w-4 mr-1" /> 原始HTML
                        </h3>
                        <pre className="bg-muted p-4 rounded border overflow-auto max-h-[600px] text-xs font-mono">
                          {itemContent}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/50 p-8 rounded-md text-center">
                      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p>选择一个章节或资源项查看其内容</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* 日志选项卡 */}
            <TabsContent value="logs">
              <Card>
                <CardHeader>
                  <CardTitle>处理日志</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-md overflow-auto h-[600px]">
                    {log.map((line, i) => (
                      <div key={i} className="text-sm font-mono mb-1">
                        {line.includes('✅') ? (
                          <span className="text-green-500">{line}</span>
                        ) : line.includes('❌') ? (
                          <span className="text-red-500">{line}</span>
                        ) : line.includes('⚠️') ? (
                          <span className="text-yellow-500">{line}</span>
                        ) : (
                          line
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
      <style jsx global>{`
        .epub-content-preview {
          color: #000 !important;
          background-color: #fff !important;
        }
        
        .epub-content-preview * {
          color: #000 !important;
          background-color: transparent !important;
        }
        
        .epub-content-preview a {
          color: #0066cc !important;
          text-decoration: underline !important;
        }
        
        .epub-content-preview h1, 
        .epub-content-preview h2, 
        .epub-content-preview h3, 
        .epub-content-preview h4, 
        .epub-content-preview h5, 
        .epub-content-preview h6 {
          color: #000 !important;
          margin-top: 1em !important;
          margin-bottom: 0.5em !important;
          font-weight: bold !important;
        }
        
        .epub-content-preview img {
          max-width: 100% !important;
          height: auto !important;
        }
      `}</style>
    </div>
  );
}