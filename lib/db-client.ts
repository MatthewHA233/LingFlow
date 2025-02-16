// lib/db-client.ts
import { createClient } from '@supabase/supabase-js';
import { Book, Chapter } from '@/types/book';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export class DbManager {
  async createBook(book: Partial<Book>, userId: string): Promise<Book> {
    const { data, error } = await supabase
      .from('books')
      .insert([
        {
          ...book,
          user_id: userId,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createChapters(chapters: Partial<Chapter>[], bookId: string): Promise<Chapter[]> {
    const { data, error } = await supabase
      .from('chapters')
      .insert(
        chapters.map((chapter, index) => ({
          ...chapter,
          book_id: bookId,
          order_index: index,
        }))
      )
      .select();

    if (error) throw error;
    return data;
  }

  async createResources(resources: any[], bookId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('book_resources')
      .insert(
        resources.map(resource => ({
          ...resource,
          book_id: bookId,
        }))
      )
      .select();

    if (error) throw error;
    return data;
  }

  async getBook(bookId: string): Promise<Book | null> {
    const { data, error } = await supabase
      .from('books')
      .select(`
        *,
        chapters (*),
        book_resources (*)
      `)
      .eq('id', bookId)
      .single();

    if (error) throw error;
    return data;
  }
}

export const dbManager = new DbManager();