export class BookParserError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'BookParserError';
  }

  static fromError(error: unknown, defaultMessage: string): BookParserError {
    if (error instanceof BookParserError) {
      return error;
    }
    return new BookParserError(
      error instanceof Error ? error.message : defaultMessage,
      error
    );
  }
}