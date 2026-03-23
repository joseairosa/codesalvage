import type { Metadata } from 'next';
import { COOKIE_CONTENT, markdownToHtml } from '@/lib/legal-content';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Cookie Policy - CodeSalvage',
  description: 'Cookie Policy for CodeSalvage marketplace.',
};

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <article className="prose prose-slate max-w-none prose-headings:scroll-mt-20">
        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(COOKIE_CONTENT) }} />
      </article>
    </div>
  );
}
