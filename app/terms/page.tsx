import type { Metadata } from 'next';
import { TERMS_CONTENT, markdownToHtml } from '@/lib/legal-content';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Terms of Service - CodeSalvage',
  description: 'Terms of Service for CodeSalvage marketplace.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <article className="prose prose-slate max-w-none prose-headings:scroll-mt-20">
        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(TERMS_CONTENT) }} />
      </article>
    </div>
  );
}
