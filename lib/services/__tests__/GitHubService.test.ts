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
      mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/readme')) return mockJsonResponse(mockReadmeResponse);
        if (url.includes('/languages')) return mockJsonResponse(mockLanguagesResponse);
        if (url.includes('/contents/')) return mock404Response();
        if (url.includes('/git/trees/')) return mockJsonResponse(mockTreeResponse);
        return mockJsonResponse(mockRepoResponse);
      });

      await service.fetchRepoData('https://github.com/owner/test-repo', 'test-token');

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


  describe('addCollaborator', () => {
    it('should send invitation and return invitationId on 201 response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 12345 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.addCollaborator(
        'owner',
        'repo',
        'newuser',
        'test-token'
      );

      expect(result).toEqual({ invitationId: '12345', alreadyCollaborator: false });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/collaborators/newuser',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ permission: 'admin' }),
        })
      );
    });

    it('should detect already collaborator on 204 response', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const result = await service.addCollaborator(
        'owner',
        'repo',
        'existinguser',
        'test-token'
      );

      expect(result).toEqual({ alreadyCollaborator: true });
    });

    it('should throw GitHubServiceError on 404 response', async () => {
      mockFetch.mockResolvedValue(
        new Response('Not Found', { status: 404, statusText: 'Not Found' })
      );

      await expect(
        service.addCollaborator('owner', 'nonexistent', 'user', 'test-token')
      ).rejects.toThrow(GitHubServiceError);

      await expect(
        service.addCollaborator('owner', 'nonexistent', 'user', 'test-token')
      ).rejects.toThrow(/not found/i);
    });

    it('should throw GitHubServiceError on 422 response', async () => {
      mockFetch.mockResolvedValue(
        new Response('Unprocessable Entity', {
          status: 422,
          statusText: 'Unprocessable Entity',
        })
      );

      await expect(
        service.addCollaborator('owner', 'repo', 'baduser', 'test-token')
      ).rejects.toThrow(GitHubServiceError);

      await expect(
        service.addCollaborator('owner', 'repo', 'baduser', 'test-token')
      ).rejects.toThrow(/validation failed/i);
    });
  });

  describe('checkCollaboratorAccess', () => {
    it('should return true when user is a collaborator (204)', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const result = await service.checkCollaboratorAccess(
        'owner',
        'repo',
        'collab-user',
        'test-token'
      );

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/collaborators/collab-user',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should return false when user is not a collaborator (404)', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Not Found', { status: 404, statusText: 'Not Found' })
      );

      const result = await service.checkCollaboratorAccess(
        'owner',
        'repo',
        'stranger',
        'test-token'
      );

      expect(result).toBe(false);
    });
  });

  describe('removeCollaborator', () => {
    it('should remove collaborator successfully (204)', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await expect(
        service.removeCollaborator('owner', 'repo', 'olduser', 'test-token')
      ).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/collaborators/olduser',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw GitHubServiceError on error response', async () => {
      mockFetch.mockResolvedValue(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
      );

      await expect(
        service.removeCollaborator('owner', 'repo', 'user', 'test-token')
      ).rejects.toThrow(GitHubServiceError);

      await expect(
        service.removeCollaborator('owner', 'repo', 'user', 'test-token')
      ).rejects.toThrow(/forbidden/i);
    });
  });


  describe('transferOwnership', () => {
    it('should return success on 202 response (transfer queued)', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, name: 'repo' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.transferOwnership(
        'owner',
        'repo',
        'new-owner',
        'test-token'
      );

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/repos/owner/repo/transfer'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ new_owner: 'new-owner' }),
        })
      );
    });

    it('should throw GitHubServiceError with 401 status on expired token', async () => {
      mockFetch.mockResolvedValue(
        new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
      );

      await expect(
        service.transferOwnership('owner', 'repo', 'new-owner', 'bad-token')
      ).rejects.toThrow(GitHubServiceError);

      await expect(
        service.transferOwnership('owner', 'repo', 'new-owner', 'bad-token')
      ).rejects.toThrow(/token expired|unauthorized/i);

      try {
        await service.transferOwnership('owner', 'repo', 'new-owner', 'bad-token');
      } catch (err) {
        expect(err instanceof GitHubServiceError && err.statusCode).toBe(401);
      }
    });

    it('should throw GitHubServiceError on 403 response (insufficient permissions)', async () => {
      mockFetch.mockResolvedValue(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
      );

      await expect(
        service.transferOwnership('owner', 'repo', 'new-owner', 'test-token')
      ).rejects.toThrow(GitHubServiceError);

      await expect(
        service.transferOwnership('owner', 'repo', 'new-owner', 'test-token')
      ).rejects.toThrow(/forbidden|permission/i);
    });

    it('should throw GitHubServiceError on 404 response (repo not found)', async () => {
      mockFetch.mockResolvedValue(
        new Response('Not Found', { status: 404, statusText: 'Not Found' })
      );

      await expect(
        service.transferOwnership('owner', 'nonexistent', 'new-owner', 'test-token')
      ).rejects.toThrow(GitHubServiceError);

      await expect(
        service.transferOwnership('owner', 'nonexistent', 'new-owner', 'test-token')
      ).rejects.toThrow(/not found/i);
    });

    it('should throw GitHubServiceError on 422 response (validation failed)', async () => {
      mockFetch.mockResolvedValue(
        new Response('Unprocessable Entity', {
          status: 422,
          statusText: 'Unprocessable Entity',
        })
      );

      await expect(
        service.transferOwnership('owner', 'repo', 'invalid-owner', 'test-token')
      ).rejects.toThrow(GitHubServiceError);

      await expect(
        service.transferOwnership('owner', 'repo', 'invalid-owner', 'test-token')
      ).rejects.toThrow(/validation failed/i);
    });

    it('should throw on unexpected status codes', async () => {
      mockFetch.mockResolvedValue(
        new Response('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      await expect(
        service.transferOwnership('owner', 'repo', 'new-owner', 'test-token')
      ).rejects.toThrow(GitHubServiceError);
    });
  });
});
