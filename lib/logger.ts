// 日志记录功能
const colors = {
  INFO: '\x1b[32m', // 绿色
  DEBUG: '\x1b[36m', // 青色
  WARN: '\x1b[33m',  // 黄色
  ERROR: '\x1b[31m', // 红色
  reset: '\x1b[0m'   // 重置
};

// 日志记录函数
export function log(level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR', requestId: string, message: string, error?: any) {
  const timestamp = new Date().toISOString();
  const colorCode = colors[level];
  const logMessage = `[${timestamp}] ${level}: [${requestId}] ${message}`;
  
  if (error) {
    console.log(`${colorCode}${logMessage}${colors.reset}`);
    console.log(`${colors.ERROR}ERROR_DETAILS: ${error.message || error}${colors.reset}`);
  } else {
    console.log(`${colorCode}${logMessage}${colors.reset}`);
  }
} 