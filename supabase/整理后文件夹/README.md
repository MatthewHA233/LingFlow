# Supabase 数据库结构整理

本文件夹包含了 LingFlow 项目的 Supabase 数据库完整结构定义，按功能模块分类整理。

## 目录结构

### 01_用户管理/
用户认证、档案、权限相关
- 枚举类型：user_role
- 表：old_auth_users, profiles
- 函数：delete_user(), is_admin(), update_old_auth_users_updated_at(), update_updated_at_column()（待添加）
- 触发器：trigger_update_old_auth_users_updated_at, update_profiles_updated_at
- RLS策略：old_auth_users表的分级访问策略（所有用户可读、认证用户可更新、服务角色完全访问）、profiles表的完全开放访问策略（所有用户可进行所有操作）
- 索引：email, has_registered, role

### 02_书籍管理/  
书籍、章节、阅读进度相关
- 枚举类型：book_type, content_type
- 表：books, chapters, book_resources, reading_progress
- 函数：clean_content_parents_after_chapter_delete(), clean_content_parents_after_page_delete(), delete_chapter_at_position(), insert_chapter_at_position(), reorder_chapter(), update_book_note_count()
- 触发器：after_chapter_delete, trigger_update_book_note_count, update_reading_progress_updated_at
- RLS策略：books表的书籍访问策略（公开查看、用户管理自己的书籍、管理员完全访问）、chapters表的章节访问策略（公开查看、用户管理自己的章节）、book_resources表的资源访问策略、reading_progress表的阅读进度策略（用户管理自己的进度）
- 索引：user_id, status, type, order_index, updated_at等

### 03_语境块/
语境块、内容块相关
- 枚举类型：block_type, conversion_status, context_block_conversion_status
- 表：content_parents, context_blocks
- 函数：complete_block_conversion(), delete_context_block(), insert_context_block(), merge_context_blocks(), reorder_blocks_after_split(), revert_block_conversion(), split_context_block(), start_block_conversion(), update_block_order(), update_translation_updated_at()
- 触发器：update_content_parents_updated_at, update_context_blocks_updated_at等
- RLS策略：content_parents表的用户内容访问策略、context_blocks表的语境块访问策略（用户完全控制、管理员访问）
- 索引：parent_id, order, type, speech_id等

### 04_锚点域/
锚点、含义块、熟练度相关
- 枚举类型：anchor_type
- 表：anchors, meaning_blocks, meaning_block_contexts, proficiency_records
- 函数：calculate_natural_decay(), extract_chinese_meaning(), extract_phonetic(), update_anchor_stats(), update_context_stats(), update_proficiency_with_review()
- 触发器：set_meaning_block_contexts_user_id, trigger_update_context_stats
- RLS策略：anchors表的用户数据隔离策略（查看、插入、更新、删除自己的锚点）、meaning_blocks表的含义块访问策略（用户管理自己的含义块，验证锚点所有权）、meaning_block_contexts表的上下文关联策略（复杂的多表权限验证）、proficiency_records表的熟练度记录策略（用户管理自己的记录，验证含义块所有权）
- 索引：text, type, anchor_id, next_review_date, reviewed_at等

### 05_音频处理/
语音识别、音频对齐相关
- 枚举类型：sentence_conversion_status
- 表：speech_results, block_sentences, sentences, words
- 函数：batch_insert_alignment_data(), delete_speech_related_data(), get_speech_results_in_timerange()
- 触发器：update_speech_results_updated_at, delete_speech_results_cascade
- RLS策略：sentences表的语音识别句子策略（通过语音结果关联验证权限）、speech_results表的语音结果策略（用户访问自己的结果、管理员完全访问）、block_sentences表的用户数据隔离策略（通过语境块关联验证用户权限）
- 索引：user_id, task_id, status, alignment_metadata(GIN), speech_id, begin_time, word等

### 06_系统管理/
系统配置、管理员功能、通知相关
- 枚举类型：message_type
- 表：system_config, system_notifications, user_notification_status
- 函数：create_notification_status(), delete_notification(), get_unread_notifications_count(), mark_all_notifications_as_read(), mark_notification_as_read()
- 触发器：update_system_config_updated_at, trigger_create_notification_status
- RLS策略：system_notifications表的分级访问策略（用户查看活跃消息、管理员完全管理）、user_notification_status表的用户通知状态策略（用户管理自己的通知状态）
- 索引：updated_at, value(GIN), created_at, type, is_active, read_at等

### 07_通用功能/
通用函数、触发器等
- 枚举类型：storage_provider
- 通用函数：check_and_fix_constraint_for_deferred(), set_user_id(), update_updated_at_column()
- 其他共享功能

## 文件命名规范

每个模块文件夹内的文件按以下顺序命名：
- 01_枚举类型.sql
- 02_表定义.sql
- 03_函数.sql
- 04_触发器.sql
- 05_RLS策略.sql
- 06_索引.sql
- 07_视图.sql

## 函数整理进度

已完成函数整理：
- 第1批（5个函数）：batch_insert_alignment_data, calculate_natural_decay, check_and_fix_constraint_for_deferred, clean_content_parents_after_chapter_delete, clean_content_parents_after_page_delete
- 第2批（5个函数）：complete_block_conversion, create_notification_status, delete_chapter_at_position, delete_context_block, delete_notification
- 第3批（5个函数）：delete_speech_related_data, delete_user, extract_chinese_meaning, extract_phonetic, get_speech_results_in_timerange
- 第4批（5个函数）：get_unread_notifications_count, insert_chapter_at_position, insert_context_block, is_admin, mark_all_notifications_as_read
- 第5批（5个函数）：mark_notification_as_read, merge_context_blocks, reorder_blocks_after_split, reorder_chapter, revert_block_conversion
- 第6批（5个函数）：set_user_id, split_context_block, start_block_conversion, update_anchor_stats, update_block_order
- 第7批（5个函数）：update_book_note_count, update_context_stats, update_proficiency_with_review, update_translation_updated_at, update_updated_at_column

## 整理进度

### 已完成项目：
- **函数整理**：35个函数（7批）✅
- **RLS策略整理**：17个表（anchors, block_sentences, book_resources, books, chapters, content_parents, context_blocks, meaning_blocks, meaning_block_contexts, old_auth_users, proficiency_records, profiles, reading_progress, sentences, speech_results, system_notifications, user_notification_status）🔄

### 当前状态：
- 所有数据库函数已按功能模块完成分类整理
- 正在进行RLS策略的模块化整理

## 更新时间

最后更新：2025-07-29