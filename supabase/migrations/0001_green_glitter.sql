/*
  # Initial database schema for e-book reader

  1. New Tables
    - `books`
      - Stores book metadata and content
    - `book_chapters` 
      - Stores individual chapter content
    - `audio_segments`
      - Stores audio alignment data
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Books table
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  title text NOT NULL,
  author text,
  cover_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Book chapters table
CREATE TABLE IF NOT EXISTS book_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES books(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  sequence_number integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Audio segments table
CREATE TABLE IF NOT EXISTS audio_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES book_chapters(id) ON DELETE CASCADE,
  start_time float NOT NULL,
  end_time float NOT NULL,
  text_content text NOT NULL,
  audio_url text,
  is_tts boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_segments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own books"
  ON books FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own books"
  ON books FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own book chapters"
  ON book_chapters FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM books 
    WHERE books.id = book_chapters.book_id 
    AND books.user_id = auth.uid()
  ));

CREATE POLICY "Users can read own audio segments"
  ON audio_segments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM book_chapters 
    JOIN books ON books.id = book_chapters.book_id
    WHERE book_chapters.id = audio_segments.chapter_id 
    AND books.user_id = auth.uid()
  ));