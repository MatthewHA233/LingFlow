import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function formatDateTime(dateString: string | null | undefined, formatStr: string = 'yyyy-MM-dd HH:mm') {
  if (!dateString) {
    return '';
  }
  
  try {
    let date: Date;
    
    // 检查是否是带时区的 ISO 字符串（以 Z 或 +/- 时区结尾）
    if (dateString.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(dateString)) {
      // 对于带时区的字符串，使用 new Date() 会自动处理时区转换
      date = new Date(dateString);
    } else {
      // 对于不带时区的字符串，假定是 UTC 时间，需要手动转换
      const parsedDate = parseISO(dateString);
      date = new Date(parsedDate.getTime() - (parsedDate.getTimezoneOffset() * 60000));
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    return format(date, formatStr, { locale: zhCN });
  } catch (error) {
    console.error('日期格式化错误:', error, dateString);
    return dateString;
  }
}

export function formatDate(dateString: string | null | undefined) {
  return formatDateTime(dateString, 'yyyy-MM-dd');
}

export function formatTime(dateString: string | null | undefined) {
  return formatDateTime(dateString, 'HH:mm:ss');
}

export function formatRelative(dateString: string | null | undefined) {
  return formatDateTime(dateString, 'PPpp');
} 