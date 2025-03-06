import { Book } from '@/types/book';
import { supabase } from '@/lib/supabase-client';

export async function updateBookCover(book: Book): Promise<Book> {
  if (!book.cover_url) {
    console.log('检查书籍封面:', book.id);
    try {
      const { data: resources, error } = await supabase
        .from('book_resources')
        .select('original_path, oss_path, resource_type, mime_type')
        .eq('book_id', book.id);

      if (error) {
        console.error('查询资源失败:', error);
        return book;
      }

      console.log('找到资源:', resources);

      // 查找可能的封面资源
      const coverResource = resources?.find(r => {
        const path = r.original_path.toLowerCase();
        // 只匹配包含 cover 的路径
        const isCover = 
          path.includes('cover') ||
          path.match(/^(?:OEBPS\/)?images?\/cover\./i) ||
          path.match(/^(?:OEBPS\/)?cover\./i);
        
        if (isCover) {
          console.log('找到封面资源:', {
            path: r.original_path,
            oss_path: r.oss_path,
            type: r.resource_type,
            mime: r.mime_type
          });
        }
        return isCover;
      });

      if (coverResource?.oss_path) {
        console.log('使用找到的封面资源:', coverResource);
        
        try {
          // 使用 API 端点更新封面 URL
          const response = await fetch('/api/books/update-cover', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              bookId: book.id,
              coverUrl: coverResource.oss_path
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('更新封面URL失败:', errorData);
            return book;
          }

          const { book: updatedBook } = await response.json();
          return updatedBook;
        } catch (error) {
          console.error('更新封面URL失败:', error);
          return book;
        }
      } else {
        console.log('未找到合适的封面资源，尝试其他图片资源');
        // 如果没有找到明确的封面，使用第一个图片资源
        const firstImage = resources?.find(r => 
          r.resource_type === 'image' && r.mime_type?.startsWith('image/')
        );
        
        if (firstImage?.oss_path) {
          console.log('使用第一个图片资源作为封面:', firstImage);
          const { error: updateError } = await supabase
            .from('books')
            .update({ cover_url: firstImage.oss_path })
            .eq('id', book.id);

          if (updateError) {
            console.error('更新封面URL失败:', updateError);
            return book;
          }

          return { ...book, cover_url: firstImage.oss_path };
        }
      }
    } catch (error) {
      console.error('处理封面失败:', error);
    }
  }
  return book;
} 