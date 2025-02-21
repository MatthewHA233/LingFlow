// lib/db-client.ts
import { Book, Chapter } from '@/types/book';
import { supabase } from '@/lib/supabase-client';

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
        chapters (*, order_index),
        book_resources (*)
      `)
      .eq('id', bookId)
      .order('order_index', { foreignTable: 'chapters', ascending: true })
      .single();

    if (error) throw error;
    return data;
  }
}

export const dbManager = new DbManager();