/**
 * Project Detail Layout Tests
 *
 * Tests for generateMetadata() in app/projects/[id]/layout.tsx:
 * - Returns correct title/description for a valid project
 * - Sets OG image URL, canonical URL, twitter card
 * - Returns robots noindex for non-active/unapproved projects
 * - Returns fallback for missing project
 */

import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockProjectFindUnique } = vi.hoisted(() => ({
  mockProjectFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: mockProjectFindUnique },
  },
}));

vi.mock('@/config/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3011',
  },
}));

import { renderToStaticMarkup } from 'react-dom/server';
import { generateMetadata, default as ProjectDetailLayout } from '../layout';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockProject = {
  id: 'proj-123',
  title: 'Awesome SaaS Dashboard',
  description:
    'A nearly complete SaaS analytics dashboard with real-time charts, user management, and billing integration. Built with React and Node.js.',
  category: 'dashboard',
  priceCents: 29900,
  completionPercentage: 85,
  techStack: ['React', 'Node.js', 'PostgreSQL'],
  status: 'active',
  isApproved: true,
  seller: { username: 'johndoe' },
};

// ---------------------------------------------------------------------------
// generateMetadata tests
// ---------------------------------------------------------------------------

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns fallback title for missing project', async () => {
    mockProjectFindUnique.mockResolvedValue(null);
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'nonexistent' }) });
    expect(meta.title).toBe('Project Not Found — CodeSalvage');
  });

  it('returns correct title for a valid project', async () => {
    mockProjectFindUnique.mockResolvedValue(mockProject);
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    expect(meta.title).toBe('Awesome SaaS Dashboard — CodeSalvage');
  });

  it('truncates description to 160 chars', async () => {
    const longDesc = 'A'.repeat(200);
    mockProjectFindUnique.mockResolvedValue({ ...mockProject, description: longDesc });
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    expect((meta.description ?? '').length).toBeLessThanOrEqual(160);
  });

  it('sets canonical URL', async () => {
    mockProjectFindUnique.mockResolvedValue(mockProject);
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    const alternates = meta.alternates as { canonical?: string } | undefined;
    expect(alternates?.canonical).toBe('http://localhost:3011/projects/proj-123');
  });

  it('sets OG image to dynamic /api/og endpoint', async () => {
    mockProjectFindUnique.mockResolvedValue(mockProject);
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    const og = meta.openGraph as { images?: Array<{ url: string }> } | undefined;
    const imageUrl = og?.images?.[0]?.url ?? '';
    expect(imageUrl).toContain('/api/og?id=proj-123');
  });

  it('sets twitter card to summary_large_image', async () => {
    mockProjectFindUnique.mockResolvedValue(mockProject);
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    const twitter = meta.twitter as { card?: string } | undefined;
    expect(twitter?.card).toBe('summary_large_image');
  });

  it('sets robots noindex for sold project', async () => {
    mockProjectFindUnique.mockResolvedValue({ ...mockProject, status: 'sold' });
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    const robots = meta.robots as { index?: boolean } | undefined;
    expect(robots?.index).toBe(false);
  });

  it('sets robots noindex for draft project', async () => {
    mockProjectFindUnique.mockResolvedValue({ ...mockProject, status: 'draft' });
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    const robots = meta.robots as { index?: boolean } | undefined;
    expect(robots?.index).toBe(false);
  });

  it('sets robots noindex for unapproved project', async () => {
    mockProjectFindUnique.mockResolvedValue({ ...mockProject, isApproved: false });
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    const robots = meta.robots as { index?: boolean } | undefined;
    expect(robots?.index).toBe(false);
  });

  it('sets robots noindex for delisted project', async () => {
    mockProjectFindUnique.mockResolvedValue({ ...mockProject, status: 'delisted' });
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    const robots = meta.robots as { index?: boolean } | undefined;
    expect(robots?.index).toBe(false);
  });

  it('sets robots index for active approved project', async () => {
    mockProjectFindUnique.mockResolvedValue(mockProject);
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    const robots = meta.robots as { index?: boolean } | undefined;
    expect(robots?.index).toBe(true);
  });

  it('includes og:type website', async () => {
    mockProjectFindUnique.mockResolvedValue(mockProject);
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'proj-123' }) });
    const og = meta.openGraph as { type?: string } | undefined;
    expect(og?.type).toBe('website');
  });
});

// ---------------------------------------------------------------------------
// JSON-LD Product schema tests
// ---------------------------------------------------------------------------

describe('ProjectDetailLayout JSON-LD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function getJsonLd(project: typeof mockProject | null) {
    mockProjectFindUnique.mockResolvedValue(project);
    const jsx = await ProjectDetailLayout({
      params: Promise.resolve({ id: 'proj-123' }),
      children: null,
    });
    const html = renderToStaticMarkup(jsx as React.ReactElement);
    const match = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/);
    if (!match?.[1]) return null;
    return JSON.parse(match[1]) as Record<string, unknown>;
  }

  it('renders no JSON-LD script when project is not found', async () => {
    const jsonLd = await getJsonLd(null);
    expect(jsonLd).toBeNull();
  });

  it('renders Product schema with correct @context and @type', async () => {
    const jsonLd = await getJsonLd(mockProject);
    expect(jsonLd?.['@context']).toBe('https://schema.org');
    expect(jsonLd?.['@type']).toBe('Product');
  });

  it('includes project name and description in JSON-LD', async () => {
    const jsonLd = await getJsonLd(mockProject);
    expect(jsonLd?.['name']).toBe('Awesome SaaS Dashboard');
    expect(typeof jsonLd?.['description']).toBe('string');
  });

  it('sets offers.priceCurrency to USD', async () => {
    const jsonLd = await getJsonLd(mockProject);
    const offers = jsonLd?.['offers'] as Record<string, unknown> | undefined;
    expect(offers?.['priceCurrency']).toBe('USD');
  });

  it('sets offers.price correctly (cents to dollars)', async () => {
    const jsonLd = await getJsonLd(mockProject);
    const offers = jsonLd?.['offers'] as Record<string, unknown> | undefined;
    expect(offers?.['price']).toBe('299.00');
  });

  it('sets availability to InStock for active approved project', async () => {
    const jsonLd = await getJsonLd(mockProject);
    const offers = jsonLd?.['offers'] as Record<string, unknown> | undefined;
    expect(offers?.['availability']).toBe('https://schema.org/InStock');
  });

  it('sets availability to SoldOut for sold project', async () => {
    const jsonLd = await getJsonLd({ ...mockProject, status: 'sold' });
    const offers = jsonLd?.['offers'] as Record<string, unknown> | undefined;
    expect(offers?.['availability']).toBe('https://schema.org/SoldOut');
  });

  it('sets availability to Discontinued for draft project', async () => {
    const jsonLd = await getJsonLd({ ...mockProject, status: 'draft' });
    const offers = jsonLd?.['offers'] as Record<string, unknown> | undefined;
    expect(offers?.['availability']).toBe('https://schema.org/Discontinued');
  });

  it('sets availability to Discontinued for unapproved project', async () => {
    const jsonLd = await getJsonLd({ ...mockProject, isApproved: false });
    const offers = jsonLd?.['offers'] as Record<string, unknown> | undefined;
    expect(offers?.['availability']).toBe('https://schema.org/Discontinued');
  });

  it('sets availability to Discontinued for delisted project', async () => {
    const jsonLd = await getJsonLd({ ...mockProject, status: 'delisted' });
    const offers = jsonLd?.['offers'] as Record<string, unknown> | undefined;
    expect(offers?.['availability']).toBe('https://schema.org/Discontinued');
  });
});
