export class BookParserError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'BookParserError';
  }
}

export function handleParserError(error: unknown): never {
  console.error('解析EPUB文件失败:', error);
  
  if (error instanceof BookParserError) {
    throw error;
  }
  
  throw new BookParserError(
    '无法解析电子书文件，请确保文件格式正确',
    error
  );
}