import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy - CodeSalvage',
  description: 'Cookie Policy for CodeSalvage marketplace.',
};

export default function CookiesPage() {
  const content = fs.readFileSync(path.join(process.cwd(), 'COOKIE_POLICY.md'), 'utf-8');

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
  return md
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^---$/gm, '<hr />')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^(?!<[hlu]|<li|<hr|<strong|<table)(.+)$/gm, '<p>$1</p>')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
}
