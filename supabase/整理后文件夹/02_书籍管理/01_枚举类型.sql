-- =============================================
-- 书籍管理模块 - 枚举类型定义
-- =============================================

-- 书籍类型
CREATE TYPE public.book_type AS ENUM (
    'book', 
    'notebook'
);
COMMENT ON TYPE public.book_type IS '书籍类型，区分普通书籍和笔记本';

-- 页面内容类型
CREATE TYPE public.content_type AS ENUM (
    'chapter', 
    'video', 
    'custom_page', 
    'collection'
);
COMMENT ON TYPE public.content_type IS '内容类型，用于区分章节、视频、自定义页面和集合';