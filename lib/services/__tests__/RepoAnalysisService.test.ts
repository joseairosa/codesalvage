/**
 * RepoAnalysisService Unit Tests
 *
 * Tests Claude API integration, JSON parsing, and Zod validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RepoAnalysisService, RepoAnalysisError, repoAnalysisSchema } from '../RepoAnalysisService';
import type { RepoData } from '../GitHubService';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

// Mock ANTHROPIC_API_KEY
vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key');

const mockRepoData: RepoData = {
  metadata: {
    name: 'test-repo',
    fullName: 'owner/test-repo',
    description: 'A test repository for unit tests',
    language: 'TypeScript',
    topics: ['web', 'typescript', 'react'],
    defaultBranch: 'main',
    stars: 42,
    forks: 5,
    openIssues: 3,
    isPrivate: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    pushedAt: '2024-06-01T00:00:00Z',
    htmlUrl: 'https://github.com/owner/test-repo',
    license: 'MIT',
  },
  readme: '# Test Project\n\nThis is a test project built with React and TypeScript.',
  languages: { TypeScript: 10000, JavaScript: 5000 },
  dependencies: { react: '^18.0.0', typescript: '^5.0.0', next: '^14.0.0' },
  dependencyFile: 'package.json',
  fileTree: [
    { path: 'src', type: 'tree' },
    { path: 'src/index.ts', type: 'blob', size: 500 },
    { path: 'package.json', type: 'blob', size: 200 },
  ],
};

const validAnalysisResponse = {
  title: 'React TypeScript Dashboard with Analytics',
  description:
    "You'll get a partially complete React dashboard built with TypeScript and Next.js. The project includes basic routing, authentication scaffolding, and a component library. Currently needs data visualization integration and API endpoints.",
  category: 'web_app',
  techStack: ['React', 'TypeScript', 'Next.js'],
  primaryLanguage: 'TypeScript',
  frameworks: ['Next.js', 'React'],
  completionPercentage: 65,
  estimatedCompletionHours: 40,
  knownIssues: 'Missing data visualization, API endpoints incomplete',
  suggestedPriceCents: 75000,
  licenseType: 'full_code',
  accessLevel: 'full',
};

describe('RepoAnalysisService', () => {
  let service: RepoAnalysisService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RepoAnalysisService();
  });

  // ============================================
  // SCHEMA VALIDATION
  // ============================================

  describe('repoAnalysisSchema', () => {
    it('should validate a correct analysis result', () => {
      const result = repoAnalysisSchema.safeParse(validAnalysisResponse);
      expect(result.success).toBe(true);
    });

    it('should reject title shorter than 5 chars', () => {
      const result = repoAnalysisSchema.safeParse({
        ...validAnalysisResponse,
        title: 'Hi',
      });
      expect(result.success).toBe(false);
    });

    it('should reject description shorter than 50 chars', () => {
      const result = repoAnalysisSchema.safeParse({
        ...validAnalysisResponse,
        description: 'Too short',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid category', () => {
      const result = repoAnalysisSchema.safeParse({
        ...validAnalysisResponse,
        category: 'invalid_category',
      });
      expect(result.success).toBe(false);
    });

    it('should reject completionPercentage below 50', () => {
      const result = repoAnalysisSchema.safeParse({
        ...validAnalysisResponse,
        completionPercentage: 30,
      });
      expect(result.success).toBe(false);
    });

    it('should reject completionPercentage above 95', () => {
      const result = repoAnalysisSchema.safeParse({
        ...validAnalysisResponse,
        completionPercentage: 100,
      });
      expect(result.success).toBe(false);
    });

    it('should reject price below minimum', () => {
      const result = repoAnalysisSchema.safeParse({
        ...validAnalysisResponse,
        suggestedPriceCents: 5000, // $50, below $100 minimum
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty techStack', () => {
      const result = repoAnalysisSchema.safeParse({
        ...validAnalysisResponse,
        techStack: [],
      });
      expect(result.success).toBe(false);
    });

    it('should allow optional fields to be missing', () => {
      const minimal = {
        title: 'A Valid Title Here',
        description:
          'A description that is long enough to pass the minimum character requirement for validation purposes.',
        category: 'web_app',
        techStack: ['React'],
        completionPercentage: 75,
        suggestedPriceCents: 50000,
        licenseType: 'full_code',
        accessLevel: 'full',
      };
      const result = repoAnalysisSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // ANALYZE REPO
  // ============================================

  describe('analyzeRepo', () => {
    it('should return validated analysis from Claude response', async () => {
      // Access the mocked Anthropic client
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockInstance = new Anthropic();
      (mockInstance.messages.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(validAnalysisResponse) }],
      });

      // Replace service client with mock
      (service as unknown as { client: typeof mockInstance }).client = mockInstance;

      const result = await service.analyzeRepo(mockRepoData);

      expect(result.title).toBe(validAnalysisResponse.title);
      expect(result.category).toBe('web_app');
      expect(result.techStack).toEqual(['React', 'TypeScript', 'Next.js']);
      expect(result.suggestedPriceCents).toBe(75000);
    });

    it('should handle Claude response with markdown code fences', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockInstance = new Anthropic();
      (mockInstance.messages.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '```json\n' + JSON.stringify(validAnalysisResponse) + '\n```',
          },
        ],
      });

      (service as unknown as { client: typeof mockInstance }).client = mockInstance;

      const result = await service.analyzeRepo(mockRepoData);
      expect(result.title).toBe(validAnalysisResponse.title);
    });

    it('should throw RepoAnalysisError when Claude returns invalid JSON', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockInstance = new Anthropic();
      (mockInstance.messages.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: [{ type: 'text', text: 'This is not JSON' }],
      });

      (service as unknown as { client: typeof mockInstance }).client = mockInstance;

      await expect(service.analyzeRepo(mockRepoData)).rejects.toThrow(RepoAnalysisError);
    });

    it('should throw RepoAnalysisError when Claude response fails Zod validation', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockInstance = new Anthropic();
      (mockInstance.messages.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...validAnalysisResponse,
              completionPercentage: 999, // Invalid
            }),
          },
        ],
      });

      (service as unknown as { client: typeof mockInstance }).client = mockInstance;

      await expect(service.analyzeRepo(mockRepoData)).rejects.toThrow(RepoAnalysisError);
    });

    it('should throw RepoAnalysisError when Claude API fails', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockInstance = new Anthropic();
      (mockInstance.messages.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('API rate limited')
      );

      (service as unknown as { client: typeof mockInstance }).client = mockInstance;

      await expect(service.analyzeRepo(mockRepoData)).rejects.toThrow(RepoAnalysisError);
    });

    it('should throw RepoAnalysisError when no text content in response', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockInstance = new Anthropic();
      (mockInstance.messages.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: [],
      });

      (service as unknown as { client: typeof mockInstance }).client = mockInstance;

      await expect(service.analyzeRepo(mockRepoData)).rejects.toThrow(RepoAnalysisError);
    });
  });
});
