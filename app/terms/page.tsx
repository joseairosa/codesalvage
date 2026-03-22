import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - CodeSalvage',
  description: 'Terms of Service for CodeSalvage marketplace.',
};

export default function TermsPage() {
  const content = fs.readFileSync(
    path.join(process.cwd(), 'TERMS_OF_SERVICE.md'),
    'utf-8'
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <article className="prose prose-slate max-w-none prose-headings:scroll-mt-20">
        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />
      </article>
    </div>
  );
}

/** Minimal markdown → HTML (no external deps) */
function markdownToHtml(md: string): string {
  return (
    md
      // Headings
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr />')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Ordered lists
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Paragraphs (lines not already wrapped)
      .replace(/^(?!<[hlu]|<li|<hr|<strong|<table)(.+)$/gm, '<p>$1</p>')
      // Clean up empty paragraphs
      .replace(/<p>\s*<\/p>/g, '')
      // Wrap consecutive <li> in <ul>
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
  );
}
