/**
 * Project Detail Layout
 *
 * Server component layout for /projects/[id] pages.
 * Exports generateMetadata for dynamic SEO metadata on project detail pages.
 * Renders JSON-LD Product schema alongside page content for structured data.
 *
 * The page.tsx for this route is a 'use client' component and cannot export
 * generateMetadata — this layout is the required server-side workaround.
 */

import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';

interface LayoutProps {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

function getSchemaAvailability(status: string, isApproved: boolean): string {
  if (!isApproved || status === 'draft' || status === 'delisted') {
    return 'https://schema.org/Discontinued';
  }
  if (status === 'sold') return 'https://schema.org/SoldOut';
  return 'https://schema.org/InStock';
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priceCents: true,
      completionPercentage: true,
      techStack: true,
      status: true,
      isApproved: true,
      seller: { select: { username: true } },
    },
  });

  if (!project) {
    return { title: 'Project Not Found — CodeSalvage' };
  }

  const isIndexable = project.status === 'active' && project.isApproved;
  const description = project.description.slice(0, 160);
  const ogImageUrl = `${env.NEXT_PUBLIC_APP_URL}/api/og?id=${project.id}`;
  const canonicalUrl = `${env.NEXT_PUBLIC_APP_URL}/projects/${project.id}`;

  return {
    title: `${project.title} — CodeSalvage`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: isIndexable,
      follow: true,
    },
    openGraph: {
      type: 'website',
      title: `${project.title} — CodeSalvage`,
      description,
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: project.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${project.title} — CodeSalvage`,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ProjectDetailLayout({ params, children }: LayoutProps) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      status: true,
      isApproved: true,
    },
  });

  const jsonLd = project
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: project.title,
        description: project.description.slice(0, 300),
        offers: {
          '@type': 'Offer',
          price: (project.priceCents / 100).toFixed(2),
          priceCurrency: 'USD',
          availability: getSchemaAvailability(project.status, project.isApproved),
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
