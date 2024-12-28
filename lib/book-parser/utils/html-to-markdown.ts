import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```'
});

// Configure turndown to handle Chinese content better
turndownService.addRule('preserveChineseSpacing', {
  filter: ['p', 'div'],
  replacement: function(content) {
    // Preserve line breaks but don't add extra spaces around Chinese characters
    return '\n\n' + content.trim() + '\n\n';
  }
});

export function convertHtmlToMarkdown(html: string): string {
  try {
    return turndownService.turndown(html);
  } catch (error) {
    console.error('HTML to Markdown conversion failed:', error);
    throw error;
  }
}