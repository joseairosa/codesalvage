/**
 * Dynamic OG Image Endpoint
 *
 * Generates Open Graph images for project pages on-the-fly.
 * Uses Next.js ImageResponse (Satori) to render a 1200x630 PNG.
 *
 * Route: GET /api/og?id=<projectId>
 *
 * Returns a fallback image for missing/invalid IDs.
 * Sets 24-hour cache headers for CDN caching.
 */

import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600';
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const MAX_ID_LENGTH = 50;

function tryLoadLogo(): Buffer | null {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'branding', 'codesalvage_logo_square.png');
    if (fs.existsSync(logoPath)) {
      return fs.readFileSync(logoPath);
    }
  } catch {
    // Logo loading is best-effort — fall back to text branding
  }
  return null;
}

function buildFallbackResponse(): Response {
  const image = new ImageResponse(
    (
      <div
        style={{
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 700, color: '#ffffff', display: 'flex' }}>
          CodeSalvage
        </div>
        <div style={{ fontSize: 24, color: '#94a3b8', marginTop: 16, display: 'flex' }}>
          Marketplace for Incomplete Software Projects
        </div>
      </div>
    ),
    { width: IMAGE_WIDTH, height: IMAGE_HEIGHT }
  );

  const headers = new Headers(image.headers);
  headers.set('Cache-Control', CACHE_CONTROL);

  return new Response(image.body, { status: 200, headers });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // Input validation — return fallback without DB query for invalid IDs
  if (!id || id.length > MAX_ID_LENGTH) {
    return buildFallbackResponse();
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      priceCents: true,
      completionPercentage: true,
      techStack: true,
      category: true,
    },
  });

  if (!project) {
    return buildFallbackResponse();
  }

  const price = `$${(project.priceCents / 100).toLocaleString('en-US')}`;
  const completion = `${project.completionPercentage}% Complete`;
  const topTech = project.techStack.slice(0, 3);

  const logoBuffer = tryLoadLogo();
  const logoDataUrl = logoBuffer
    ? `data:image/png;base64,${logoBuffer.toString('base64')}`
    : null;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
          padding: '48px 60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header: branding */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 48 }}>
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} width={40} height={40} alt="CodeSalvage" style={{ borderRadius: 8 }} />
          ) : null}
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: '#64748b',
              marginLeft: logoDataUrl ? 12 : 0,
              display: 'flex',
            }}
          >
            CodeSalvage
          </div>
        </div>

        {/* Project title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.15,
            flex: 1,
            display: 'flex',
            alignItems: 'flex-start',
          }}
        >
          {project.title.length > 60 ? `${project.title.slice(0, 57)}...` : project.title}
        </div>

        {/* Footer: price, completion, tech stack */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Price badge */}
          <div
            style={{
              background: '#22c55e',
              color: '#ffffff',
              fontSize: 28,
              fontWeight: 700,
              padding: '8px 20px',
              borderRadius: 12,
              display: 'flex',
            }}
          >
            {price}
          </div>

          {/* Completion badge */}
          <div
            style={{
              background: '#3b82f6',
              color: '#ffffff',
              fontSize: 22,
              fontWeight: 600,
              padding: '8px 20px',
              borderRadius: 12,
              display: 'flex',
            }}
          >
            {completion}
          </div>

          {/* Tech stack pills */}
          {topTech.map((tech: string) => (
            <div
              key={tech}
              style={{
                background: '#334155',
                color: '#94a3b8',
                fontSize: 20,
                fontWeight: 500,
                padding: '8px 16px',
                borderRadius: 10,
                display: 'flex',
              }}
            >
              {tech}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: IMAGE_WIDTH, height: IMAGE_HEIGHT }
  );

  const headers = new Headers(image.headers);
  headers.set('Cache-Control', CACHE_CONTROL);

  return new Response(image.body, { status: 200, headers });
}
