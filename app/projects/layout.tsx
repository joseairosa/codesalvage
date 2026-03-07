/**
 * Projects Browse Layout
 *
 * Server component layout for /projects pages.
 * Sets static metadata for the browse/search page.
 *
 * Note: app/projects/page.tsx is a 'use client' component and cannot export
 * metadata — this layout is the required server-side workaround.
 *
 * The nested app/projects/[id]/layout.tsx overrides this metadata for
 * individual project detail pages via Next.js metadata merging.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Projects — CodeSalvage',
  description:
    'Browse incomplete software projects for sale. Find 50-95% complete apps, dashboards, tools, and more. Buy and finish a project that fits your vision.',
  openGraph: {
    type: 'website',
    title: 'Browse Projects — CodeSalvage',
    description:
      'Browse incomplete software projects for sale. Find 50-95% complete apps, dashboards, tools, and more.',
    images: [
      {
        url: '/images/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'CodeSalvage — Browse Projects',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Browse Projects — CodeSalvage',
    description:
      'Browse incomplete software projects for sale. Find 50-95% complete apps, dashboards, tools, and more.',
    images: ['/images/opengraph-image.png'],
  },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
