import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Sanitizes rendered HTML to prevent XSS attacks while allowing safe formatting.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bon\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:');
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '';
    try {
      const rawHtml = marked.parse(content) as string;
      // Wrap tables in an overflow container for responsive horizontal scrolling
      const tableWrapped = rawHtml
        .replace(
          /<table>/g,
          '<div class="my-3 overflow-x-auto rounded-lg border border-slate-200 shadow-2xs bg-white"><table class="w-full text-left text-xs border-collapse">'
        )
        .replace(/<\/table>/g, '</table></div>');

      return sanitizeHtml(tableWrapped);
    } catch {
      // Fallback in case of parse error
      return content;
    }
  }, [content]);

  return (
    <div
      className={`chat-markdown ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
