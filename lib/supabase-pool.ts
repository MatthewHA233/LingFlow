import postgres from 'postgres';
import { log } from './logger';
import { uploadToOSS } from '@/lib/oss-client';  // 确保这个文件存在

// 连接池配置
const POOL_SIZE = 50; // 连接池大小
const IDLE_TIMEOUT = 30; // 空闲超时（秒）

let sql: postgres.Sql | null = null;
let initializationError: Error | null = null;

// 在文件顶部添加接口定义
interface ContentBlock {
  parent_id: string;
  block_type: string;
  content: string;
  order_index: number;
  metadata: string;
}

function getRandomString() {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * 获取数据库连接池实例
 */
function getPool(requestId: string = getRandomString()) {
  if (initializationError) {
    log('ERROR', requestId, '🔴 连接池初始化失败，无法获取连接', initializationError);
    throw initializationError;
  }

  if (!sql) {
    try {
      log('INFO', requestId, '🔄 初始化 PostgreSQL 连接池');
      
      // 检查环境变量
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL 环境变量未设置');
      }

      // 创建连接池，使用更新的配置
      sql = postgres(process.env.DATABASE_URL, {
        max: POOL_SIZE,               // 最大连接数
        idle_timeout: IDLE_TIMEOUT,   // 空闲连接超时时间（秒）
        max_lifetime: 60 * 30,        // 连接最大生命周期（秒）
        connect_timeout: 10,          // 连接超时（秒）
        prepare: false,               // 对事务模式禁用预处理语句
        debug: process.env.NODE_ENV === 'development', // 开发环境开启调试
      });
      
      log('INFO', requestId, `✅ 连接池初始化成功，大小: ${POOL_SIZE}`);
    } catch (error: any) {
      log('ERROR', requestId, '🔴 连接池初始化失败', error);
      initializationError = error;
      throw error;
    }
  }

  return sql;
}

/**
 * 执行带有重试机制的数据库操作
 */
export async function executeWithRetry<T>(
  requestId: string,
  operation: string,
  callback: (sql: postgres.Sql) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const pool = getPool(requestId);
      log('DEBUG', requestId, `⏱️ 执行数据库操作: ${operation} (尝试 ${retryCount + 1})`);
      const result = await callback(pool);
      return result;
    } catch (error: any) {
      lastError = error;
      retryCount++;
      
      // 如果是连接问题，则等待一段时间再重试
      if (error.code === '57P01' || error.code === '57P02' || error.code === '57P03') {
        const delay = Math.min(100 * Math.pow(2, retryCount), 2000); // 指数回退
        log('WARN', requestId, `⚠️ 数据库连接问题，${retryCount < maxRetries ? `等待 ${delay}ms 后重试` : '达到最大重试次数'}`, error);
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        // 非连接问题直接抛出
        throw error;
      }
    }
  }
  
  throw lastError || new Error(`数据库操作失败: ${operation}`);
}

// 批量插入助手函数
export async function batchInsert<T extends Record<string, any>>(
  requestId: string,
  tableName: string,
  records: T[],
  batchSize = 100
): Promise<void> {
  if (!records.length) return;
  
  const sql = getPool(requestId);
  const batches = [];
  
  // 将记录分批
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }
  
  log('DEBUG', requestId, `🔄 批量插入 ${records.length} 条记录到 ${tableName}，分 ${batches.length} 批执行`);
  
  // 并发执行批量插入，但限制并发数
  const concurrencyLimit = 5;
  for (let i = 0; i < batches.length; i += concurrencyLimit) {
    const batchPromises = batches.slice(i, i + concurrencyLimit).map(async (batch, idx) => {
      const batchNumber = i + idx + 1;
      log('DEBUG', requestId, `⏱️ 执行批次 ${batchNumber}/${batches.length}，记录数: ${batch.length}`);
      
      if (batch.length > 0) {
        // 获取列名
        const columns = Object.keys(batch[0]);
        
        // 构建 SQL 查询，使用 VALUES 语法
        let query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES `;
        
        // 为每条记录创建占位符
        const placeholders: string[] = [];
        const values: any[] = [];
        
        batch.forEach((record, recordIndex) => {
          // 为每条记录创建一组占位符，如 ($1, $2, $3)
          const recordPlaceholders: string[] = [];
          
          columns.forEach(column => {
            recordPlaceholders.push(`$${values.length + 1}`);
            values.push(record[column]);
          });
          
          placeholders.push(`(${recordPlaceholders.join(', ')})`);
        });
        
        query += placeholders.join(', ');
        
        // 执行查询
        await sql.unsafe(query, ...values);
      }
    });
    
    await Promise.all(batchPromises);
  }
  
  log('INFO', requestId, `✅ 完成批量插入到 ${tableName}，共 ${records.length} 条记录`);
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
  if (sql) {
    await sql.end();
    sql = null;
  }
}

/**
 * 针对章节上传优化的批量处理函数
 */
async function batchProcessChapters(
  requestId: string,
  bookId: string,
  userId: string,
  chapters: Array<{title: string, content: string, blocks: any[]}>
): Promise<{chapterIds: string[], blockCount: number}> {
  const sql = getPool(requestId);
  
  // 使用单个事务处理所有操作
  return await sql.begin(async (transaction) => {
    log('INFO', requestId, `🔄 开始批量处理 ${chapters.length} 个章节（事务模式）`);
    
    // 1. 创建所有章节父记录 - 一次性操作
    const contentParentQuery = `
      INSERT INTO content_parents 
        (content_type, title, user_id, metadata)
      VALUES (
        'chapter',
        unnest($1::text[]),
        $2::uuid,
        jsonb_build_object('book_id', $3::uuid, 'chapter_index', generate_subscripts($1::text[], 1) - 1)
      )
      RETURNING id, title, metadata, (array_position($1::text[], title) - 1) as idx
    `;
    
    const titles = chapters.map(c => c.title);
    const parentInsertResult = await transaction.unsafe<Array<{
      id: string;
      title: string;
      metadata: any;
      idx: number;
    }>>(contentParentQuery, [titles, userId, bookId]);
    
    log('INFO', requestId, `✅ 批量创建章节父记录完成，数量: ${parentInsertResult.length}`);
    
    // 2. 创建所有章节记录 - 一次性操作
    const chaptersQuery = `
      INSERT INTO chapters 
        (book_id, title, order_index, parent_id)
      SELECT 
        $1::uuid as book_id,
        unnest($2::text[]) as title,
        unnest($3::int[]) as order_index,
        unnest($4::uuid[]) as parent_id
      RETURNING id, book_id, title, order_index, parent_id
    `;
    
    // 准备数据数组
    const chapterTitles = parentInsertResult.map(p => p.title);
    const chapterOrders = parentInsertResult.map(p => p.idx);
    const parentIds = parentInsertResult.map(p => p.id);
    
    const chapterInsertResult = await transaction.unsafe<Array<{
      id: string;
      book_id: string;
      title: string;
      order_index: number;
      parent_id: string;
    }>>(chaptersQuery, [bookId, chapterTitles, chapterOrders, parentIds]);
    
    log('INFO', requestId, `✅ 批量创建章节记录完成，数量: ${chapterInsertResult.length}`);
    
    // 3. 创建所有内容块 - 批量处理
    const allBlocks: ContentBlock[] = [];
    
    // 预处理所有块
    for (let i = 0; i < chapters.length; i++) {
      const parent = parentInsertResult.find(p => p.idx === i);
      if (!parent) continue;
      
      chapters[i].blocks.forEach((block, blockIndex) => {
        allBlocks.push({
          parent_id: parent.id,
          block_type: block.type,
          content: block.content,
          order_index: blockIndex,
          metadata: JSON.stringify(block.metadata || {})
        });
      });
    }
    
    // 使用更大的批次大小
    const BATCH_SIZE = 5000;

    // 并行执行批量插入
    const CONCURRENT_INSERTS = 3;
    const batches = [];
    for (let i = 0; i < allBlocks.length; i += BATCH_SIZE) {
      batches.push(allBlocks.slice(i, i + BATCH_SIZE));
    }

    // 并行执行批次，但控制并发数
    for (let i = 0; i < batches.length; i += CONCURRENT_INSERTS) {
      const batchPromises = batches.slice(i, i + CONCURRENT_INSERTS).map(batch => {
        return insertBatch(transaction, batch);
      });
      await Promise.all(batchPromises);
    }
    
    log('INFO', requestId, `✅ 批量创建内容块完成，总数: ${allBlocks.length}`);
    
    return {
      chapterIds: chapterInsertResult.map(c => c.id),
      blockCount: allBlocks.length
    };
  });
}

// insertBatch 函数现在可以使用 ContentBlock 接口
async function insertBatch(transaction: postgres.Sql, batch: ContentBlock[]): Promise<void> {
  if (batch.length === 0) return;
  
  const columns = ['parent_id', 'block_type', 'content', 'order_index', 'metadata'] as const;
  let query = `INSERT INTO context_blocks (${columns.join(',')}) VALUES `;
  
  const placeholders: string[] = [];
  const values: any[] = [];
  
  batch.forEach(block => {
    const rowPlaceholders: string[] = [];
    
    columns.forEach(col => {
      rowPlaceholders.push(`$${values.length + 1}`);
      values.push(block[col]);
    });
    
    placeholders.push(`(${rowPlaceholders.join(',')})`);
  });
  
  query += placeholders.join(',');
  
  // 执行查询
  await transaction.unsafe(query, values);
}

// 优化资源上传函数
async function uploadResourceBatch(
  resources: Array<{data: Buffer, name: string}>,
  concurrency = 5
): Promise<Array<{url: string, name: string}>> {
  const results = [];
  const queue = [...resources];
  
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const uploadPromises = batch.map(resource => 
      uploadToOSS(resource.data, resource.name)
    );
    
    const batchResults = await Promise.all(uploadPromises);
    results.push(...batchResults);
  }
  
  return results;
}

// 优化数据库批量插入
async function batchInsertResources(
  transaction: postgres.Sql,
  resources: Array<{url: string, type: string, /* ... */}>,
  batchSize = 1000
) {
  const batches = [];
  for (let i = 0; i < resources.length; i += batchSize) {
    batches.push(resources.slice(i, i + batchSize));
  }
  
  // 串行执行批量插入（因为在同一个事务中）
  for (const batch of batches) {
    await transaction.unsafe(buildBatchInsertQuery('book_resources', batch));
  }
}

// 添加批量插入查询构建函数
function buildBatchInsertQuery(table: string, records: Record<string, any>[]): string {
  if (!records.length) return '';
  
  const columns = Object.keys(records[0]);
  const values = records.map(r => 
    `(${columns.map(c => typeof r[c] === 'string' ? `'${r[c]}'` : r[c]).join(',')})`
  );
  
  return `INSERT INTO ${table} (${columns.join(',')}) VALUES ${values.join(',')}`;
}

// 在底部统一导出所有函数
export {
  getPool,
  uploadResourceBatch,
  batchInsertResources,
  buildBatchInsertQuery,
  batchProcessChapters
};

