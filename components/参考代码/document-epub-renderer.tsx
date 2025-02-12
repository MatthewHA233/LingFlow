// 导入必要的 React hooks 和组件
// useState: 管理组件状态
// useEffect: 处理副作用
// useContext: 访问上下文数据
// useCallback: 优化性能的回调函数
import { useCallback, useContext, useEffect, useState } from "react";
import {
  DocumentActionsButton,
  DocumentConfigButton,
  LoaderSpin,
  MarkdownWrapper,
} from "@renderer/components";

// 导入 EPUB 相关处理库和工具函数
import { makeBook } from "foliate-js/view.js";
import { EPUB } from "foliate-js/epub.js";
import { blobToDataUrl } from "@renderer/lib/utils";
// Turndown 用于将 HTML 转换为 Markdown
import Turndown from "turndown";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
  toast,
} from "@renderer/components/ui";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MenuIcon,
  TableOfContentsIcon,
} from "lucide-react";
import {
  AppSettingsProviderContext,
  DocumentProviderContext,
} from "@renderer/context";

export const DocumentEpubRenderer = () => {
  // 从 Context 中获取文档相关的属性和方法
  const {
    ref,                // 引用
    document,           // 文档对象
    onSpeech,          // 语音功能处理
    section,           // 当前章节
    setSection,        // 设置当前章节
    onSegmentVisible,  // 段落可见性处理
    content,           // 内容
    setContent,        // 设置内容
  } = useContext(DocumentProviderContext);
  const { EnjoyApp } = useContext(AppSettingsProviderContext);

  // 组件内部状态
  const [book, setBook] = useState<typeof EPUB>();        // EPUB 书籍对象
  const [title, setTitle] = useState<string>("");         // 当前章节标题
  const [loading, setLoading] = useState<boolean>(true);  // 加载状态

  // 更新书籍元数据
  const refreshBookMetadata = () => {
    if (!book) return;

    // 如果文档标题与书籍元数据不一致，更新文档信息
    if (document.title !== book.metadata.title) {
      EnjoyApp.documents.update(document.id, {
        title: book.metadata.title,
        language: book.metadata.language,
      });
    }
  };

  // 渲染当前章节内容
  const renderCurrentSection = async () => {
    setLoading(true);

    try {
      // 创建当前章节的文档对象
      const sectionDoc = await book.sections[section].createDocument();
      // 查找目录项，设置标题
      const tocItem = book.toc.find((item: any) => item.href === sectionDoc.id);
      setTitle(tocItem?.label || sectionDoc.title);

      // 处理章节中的图片
      for (const img of sectionDoc.body.querySelectorAll("img")) {
        let image: any;
        // 查找图片资源
        if (img.src) {
          image = book.resources.manifest.find((resource: any) =>
            resource.href.endsWith(new URL(img.src).pathname)
          );
        } else if (img.id) {
          image = book.resources.manifest.find(
            (resource: any) => resource.id === img.id
          );
        }
        if (!image) continue;

        // 将图片转换为 base64 格式
        const blob = new Blob([await book.loadBlob(image.href)], {
          type: image.mediaType,
        });
        const url = await blobToDataUrl(blob);
        img.setAttribute("src", url);
      }

      // 将 HTML 内容转换为 Markdown
      const markdownContent = new Turndown().turndown(
        sectionDoc.body.innerHTML
      );
      setContent(markdownContent);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 导航到上一章节
  const handlePrevSection = () => {
    if (section === 0) return;
    if (!book) return;
    setSection(section - 1);
  };

  // 导航到下一章节
  const handleNextSection = () => {
    if (section === book.sections.length - 1) return;
    if (!book) return;
    setSection(section + 1);
  };

  // 处理目录项点击，跳转到指定章节
  const handleSectionClick = useCallback(
    (id: string) => {
      const sec = book.sections.findIndex((sec: any) => sec.id.endsWith(id));
      if (sec === -1) return;
      setSection(sec);
    },
    [book]
  );

  // 处理内部链接点击
  const handleLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      handleSectionClick(new URL(e.currentTarget.href).pathname);
      e.currentTarget.blur();
    },
    [handleSectionClick]
  );

  // 组件加载时初始化 EPUB 书籍
  useEffect(() => {
    makeBook(document.src).then((epub: typeof EPUB) => {
      setBook(epub);
      setLoading(false);
    });
  }, [document?.src]);

  // 当书籍对象或章节变化时更新内容
  useEffect(() => {
    if (!book) return;
    refreshBookMetadata();
    renderCurrentSection();
  }, [book, section]);

  // 渲染加载动画
  if (!book) return <LoaderSpin />;

  // 渲染主要内容
  return (
    <div className="select-text relative">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between space-x-2 sticky top-0 z-10 bg-background py-2">
        {/* 左侧按钮组：目录、配置、操作按钮 */}
        <div className="flex items-center gap-2">
          {/* ... existing code ... */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-6 h-6">
                <TableOfContentsIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="start"
              className="w-64 max-h-96 overflow-y-auto"
            >
              {(book?.toc as any[]).map((item: any) => (
                <div key={item.href}>
                  <DropdownMenuItem
                    className="cursor-pointer text-sm"
                    key={item.href}
                    onClick={() => handleSectionClick(item.href)}
                  >
                    {item.label}
                  </DropdownMenuItem>
                  {(item.subitems || []).map((subitem: any) => (
                    <DropdownMenuItem
                      className="cursor-pointer pl-4 text-sm text-muted-foreground"
                      key={subitem.href}
                      onClick={() => handleSectionClick(subitem.href)}
                    >
                      {subitem.label}
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DocumentConfigButton document={document} />
          <DocumentActionsButton document={document} />
        </div>
        {/* 中间显示当前章节标题 */}
        <div className="text-xs text-muted-foreground truncate">{title}</div>
        {/* 右侧导航按钮：上一章、下一章 */}
        <div className="flex items-center gap-2">
          {/* ... existing code ... */}
          <Button
            onClick={handlePrevSection}
            variant="ghost"
            size="icon"
            className="w-6 h-6"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </Button>
          <Button
            onClick={handleNextSection}
            variant="ghost"
            size="icon"
            className="w-6 h-6"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* 内容区域：显示加载动画或章节内容 */}
      <div id="start-anchor" />
      {loading ? (
        <LoaderSpin />
      ) : (
        <MarkdownWrapper
          className="mx-auto max-w-full document-renderer"
          onLinkClick={handleLinkClick}
          onSegmentVisible={onSegmentVisible}
          autoTranslate={document.config.autoTranslate}
          onSpeech={onSpeech}
          translatable={true}
          section={section}
        >
          {content}
        </MarkdownWrapper>
      )}
    </div>
  );
};