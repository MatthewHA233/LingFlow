import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
});

export function convertHtmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}