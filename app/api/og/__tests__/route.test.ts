/**
 * OG Image Endpoint Tests
 *
 * Tests for GET /api/og?id=<projectId>:
 * - Returns image content-type for valid project
 * - Returns fallback for missing project
 * - Returns fallback for missing/invalid id param
 * - Includes cache headers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockProjectFindUnique } = vi.hoisted(() => ({
  mockProjectFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: mockProjectFindUnique },
  },
}));

// Mock next/og ImageResponse — in test environment it's not available
vi.mock('next/og', () => ({
  ImageResponse: vi.fn().mockImplementation((_element: unknown, _options: unknown) => {
    return new Response('PNG_IMAGE_DATA', {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  }),
}));

// Mock fs for logo loading
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('logo')),
  },
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('logo')),
}));

vi.mock('@/config/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3011',
  },
}));

import { GET } from '../route';

const mockProject = {
  id: 'proj-123',
  title: 'Awesome SaaS Dashboard',
  priceCents: 29900,
  completionPercentage: 85,
  techStack: ['React', 'Node.js', 'PostgreSQL'],
  category: 'dashboard',
};

function makeRequest(id?: string): Request {
  const url = id
    ? `http://localhost:3011/api/og?id=${id}`
    : 'http://localhost:3011/api/og';
  return new Request(url);
}

describe('GET /api/og', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns image/png content-type for valid project', async () => {
    mockProjectFindUnique.mockResolvedValue(mockProject);
    const response = await GET(makeRequest('proj-123'));
    expect(response.headers.get('Content-Type')).toContain('image/png');
  });

  it('returns a response for missing project (fallback image)', async () => {
    mockProjectFindUnique.mockResolvedValue(null);
    const response = await GET(makeRequest('nonexistent'));
    expect(response).toBeDefined();
    expect(response.status).toBeLessThan(500);
  });

  it('includes cache-control header on fallback response for missing project', async () => {
    mockProjectFindUnique.mockResolvedValue(null);
    const response = await GET(makeRequest('nonexistent'));
    const cacheControl = response.headers.get('Cache-Control') ?? '';
    expect(cacheControl).toContain('max-age=');
  });

  it('returns fallback immediately when id is missing (no DB query)', async () => {
    const response = await GET(makeRequest());
    expect(mockProjectFindUnique).not.toHaveBeenCalled();
    expect(response).toBeDefined();
  });

  it('includes cache-control header on fallback response for missing id', async () => {
    const response = await GET(makeRequest());
    const cacheControl = response.headers.get('Cache-Control') ?? '';
    expect(cacheControl).toContain('max-age=');
  });

  it('returns fallback immediately when id is too long (no DB query)', async () => {
    const longId = 'a'.repeat(51);
    const response = await GET(makeRequest(longId));
    expect(mockProjectFindUnique).not.toHaveBeenCalled();
    expect(response).toBeDefined();
  });

  it('includes cache-control header', async () => {
    mockProjectFindUnique.mockResolvedValue(mockProject);
    const response = await GET(makeRequest('proj-123'));
    const cacheControl = response.headers.get('Cache-Control') ?? '';
    expect(cacheControl).toContain('max-age=');
  });

  it('queries DB with the project id', async () => {
    mockProjectFindUnique.mockResolvedValue(mockProject);
    await GET(makeRequest('proj-123'));
    expect(mockProjectFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'proj-123' } })
    );
  });
});
