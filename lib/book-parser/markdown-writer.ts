import { Chapter } from './types';

export async function saveChaptersToMarkdown(chapters: Chapter[], bookTitle: string): Promise<void> {
  try {
    // 创建一个包含所有章节的单一 Markdown 文件
    const allChaptersMarkdown = chapters.map(chapter => {
      const chapterTitle = `# ${chapter.title}\n\n`;
      const content = chapter.content;
      return chapterTitle + content;
    }).join('\n\n---\n\n');

    // 创建 Blob 对象
    const blob = new Blob([allChaptersMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    // 创建下载链接
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bookTitle}.md`;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('保存章节失败:', error);
    throw error;
  }
}