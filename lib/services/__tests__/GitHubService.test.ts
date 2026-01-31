/**
 * GitHubService Unit Tests
 *
 * Tests URL parsing, repo data fetching, and dependency file parsing.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitHubService, GitHubServiceError } from '../GitHubService';

describe('GitHubService', () => {
  let service: GitHubService;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitHubService();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ============================================
  // URL PARSING
  // ============================================

  describe('parseGitHubUrl', () => {
    it('should parse standard GitHub URL', () => {
      const result = service.parseGitHubUrl('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse URL with .git suffix', () => {
      const result = service.parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse URL with trailing slash', () => {
      const result = service.parseGitHubUrl('https://github.com/owner/repo/');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse URL without protocol', () => {
      const result = service.parseGitHubUrl('github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse URL with www prefix', () => {
      const result = service.parseGitHubUrl('https://www.github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should handle owner/repo with dots and hyphens', () => {
      const result = service.parseGitHubUrl('https://github.com/my-org/my.project-name');
      expect(result).toEqual({ owner: 'my-org', repo: 'my.project-name' });
    });

    it('should throw on invalid URL', () => {
      expect(() => service.parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow(
        GitHubServiceError
      );
    });

    it('should throw on URL without repo', () => {
      expect(() => service.parseGitHubUrl('https://github.com/owner')).toThrow(
        GitHubServiceError
      );
    });

    it('should throw on empty string', () => {
      expect(() => service.parseGitHubUrl('')).toThrow(GitHubServiceError);
    });
  });

  // ============================================
  // FETCH REPO DATA
  // ============================================

  describe('fetchRepoData', () => {
    const mockRepoResponse = {
      name: 'test-repo',
      full_name: 'owner/test-repo',
      description: 'A test repository',
      language: 'TypeScript',
      topics: ['web', 'typescript'],
      default_branch: 'main',
      stargazers_count: 42,
      forks_count: 5,
      open_issues_count: 3,
      private: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      pushed_at: '2024-06-01T00:00:00Z',
      html_url: 'https://github.com/owner/test-repo',
      license: { spdx_id: 'MIT' },
    };

    const mockReadmeResponse = {
      encoding: 'base64',
      content: Buffer.from('# Test Project\n\nThis is a test.').toString('base64'),
    };

    const mockLanguagesResponse = {
      TypeScript: 10000,
      JavaScript: 5000,
    };

    const mockTreeResponse = {
      tree: [
        { path: 'src', type: 'tree' },
        { path: 'src/index.ts', type: 'blob', size: 500 },
        { path: 'package.json', type: 'blob', size: 200 },
      ],
    };

    function mockJsonResponse(data: unknown) {
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    function mock404Response() {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' });
    }

    it('should pass access token in Authorization header', async () => {
      // Use mockImplementation to return appropriate responses based on URL
      mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/readme')) return mockJsonResponse(mockReadmeResponse);
        if (url.includes('/languages')) return mockJsonResponse(mockLanguagesResponse);
        if (url.includes('/contents/')) return mock404Response(); // no dep file
        if (url.includes('/git/trees/')) return mockJsonResponse(mockTreeResponse);
        return mockJsonResponse(mockRepoResponse); // default: repo metadata
      });

      await service.fetchRepoData('https://github.com/owner/test-repo', 'test-token');

      // Check that Authorization header was included
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/repos/owner/test-repo'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw GitHubServiceError when repo not found', async () => {
      // ALL GitHub API calls return 404
      mockFetch.mockImplementation(async () => mock404Response());

      await expect(
        service.fetchRepoData('https://github.com/owner/nonexistent')
      ).rejects.toThrow(GitHubServiceError);
    });

    it('should handle missing README gracefully', async () => {
      mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/readme')) return mock404Response();
        if (url.includes('/languages')) return mockJsonResponse(mockLanguagesResponse);
        if (url.includes('/contents/')) return mock404Response();
        if (url.includes('/git/trees/')) return mockJsonResponse(mockTreeResponse);
        return mockJsonResponse(mockRepoResponse);
      });

      const result = await service.fetchRepoData('https://github.com/owner/test-repo');

      expect(result.readme).toBeNull();
      expect(result.metadata.name).toBe('test-repo');
    });

    it('should parse package.json dependencies', async () => {
      const packageJson = {
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      };

      mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/readme')) return mockJsonResponse(mockReadmeResponse);
        if (url.includes('/languages')) return mockJsonResponse(mockLanguagesResponse);
        if (url.includes('/contents/package.json'))
          return mockJsonResponse({
            encoding: 'base64',
            content: Buffer.from(JSON.stringify(packageJson)).toString('base64'),
          });
        if (url.includes('/contents/')) return mock404Response();
        if (url.includes('/git/trees/')) return mockJsonResponse(mockTreeResponse);
        return mockJsonResponse(mockRepoResponse);
      });

      const result = await service.fetchRepoData('https://github.com/owner/test-repo');

      expect(result.dependencies).toEqual({
        react: '^18.0.0',
        typescript: '^5.0.0',
      });
      expect(result.dependencyFile).toBe('package.json');
    });

    it('should return metadata fields correctly', async () => {
      mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/readme')) return mockJsonResponse(mockReadmeResponse);
        if (url.includes('/languages')) return mockJsonResponse(mockLanguagesResponse);
        if (url.includes('/contents/')) return mock404Response();
        if (url.includes('/git/trees/')) return mockJsonResponse(mockTreeResponse);
        return mockJsonResponse(mockRepoResponse);
      });

      const result = await service.fetchRepoData('https://github.com/owner/test-repo');

      expect(result.metadata.name).toBe('test-repo');
      expect(result.metadata.fullName).toBe('owner/test-repo');
      expect(result.metadata.stars).toBe(42);
      expect(result.metadata.forks).toBe(5);
      expect(result.metadata.language).toBe('TypeScript');
      expect(result.metadata.license).toBe('MIT');
      expect(result.metadata.isPrivate).toBe(false);
    });
  });
});
