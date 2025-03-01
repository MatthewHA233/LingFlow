/**
 * 格式化时间（毫秒转为时:分:秒格式）
 */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
}

/**
 * 格式化持续时间（仅显示分:秒）
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  return `${minutes}:${pad(seconds % 60)}`;
} 