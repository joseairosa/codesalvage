/**
 * GitHubService - GitHub Repository Data Fetching
 *
 * Responsibilities:
 * - Fetch repository metadata from GitHub REST API
 * - Fetch README, dependency files, and file trees
 * - Parse GitHub URLs into owner/repo
 * - Support both public repos (no auth) and private repos (with OAuth token)
 *
 * Architecture:
 * - Uses GitHub REST API v3 via fetch
 * - No SDK dependency — keeps bundle small
 * - Returns structured data for AI analysis
 *
 * @example
 * const githubService = new GitHubService();
 * const repoData = await githubService.fetchRepoData('https://github.com/owner/repo');
 */

export class GitHubServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'GitHubServiceError';
  }
}

export interface RepoMetadata {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  topics: string[];
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  htmlUrl: string;
  license: string | null;
}

export interface RepoLanguages {
  [language: string]: number;
}

export interface RepoFileEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

export interface RepoData {
  metadata: RepoMetadata;
  readme: string | null;
  languages: RepoLanguages;
  dependencies: Record<string, string> | null;
  dependencyFile: string | null;
  fileTree: RepoFileEntry[];
}

const GITHUB_API_BASE = 'https://api.github.com';
const MAX_FILE_TREE_ENTRIES = 200;

export class GitHubService {
  /**
   * Parse a GitHub URL into owner and repo name.
   *
   * Supports formats:
   * - https://github.com/owner/repo
   * - https://github.com/owner/repo.git
   * - github.com/owner/repo
   */
  parseGitHubUrl(url: string): { owner: string; repo: string } {
    const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');

    const match = cleaned.match(
      /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/
    );

    if (!match || !match[1] || !match[2]) {
      throw new GitHubServiceError(
        'Invalid GitHub URL. Expected format: https://github.com/owner/repo'
      );
    }

    return { owner: match[1], repo: match[2] };
  }

  /**
   * Fetch all repo data needed for AI analysis.
   */
  async fetchRepoData(githubUrl: string, accessToken?: string): Promise<RepoData> {
    const { owner, repo } = this.parseGitHubUrl(githubUrl);

    const [metadata, readme, languages, dependencies, fileTree] =
      await Promise.allSettled([
        this.fetchMetadata(owner, repo, accessToken),
        this.fetchReadme(owner, repo, accessToken),
        this.fetchLanguages(owner, repo, accessToken),
        this.fetchDependencies(owner, repo, accessToken),
        this.fetchFileTree(owner, repo, accessToken),
      ]);

    if (metadata.status === 'rejected') {
      const msg =
        metadata.reason instanceof Error
          ? metadata.reason.message
          : String(metadata.reason);
      throw new GitHubServiceError(`Failed to fetch repository: ${msg}`);
    }

    return {
      metadata: metadata.value,
      readme: readme.status === 'fulfilled' ? readme.value : null,
      languages: languages.status === 'fulfilled' ? languages.value : {},
      dependencies: dependencies.status === 'fulfilled' ? dependencies.value.deps : null,
      dependencyFile:
        dependencies.status === 'fulfilled' ? dependencies.value.file : null,
      fileTree: fileTree.status === 'fulfilled' ? fileTree.value : [],
    };
  }

  private async fetchMetadata(
    owner: string,
    repo: string,
    token?: string
  ): Promise<RepoMetadata> {
    const data = await this.githubFetch(`/repos/${owner}/${repo}`, token);

    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      language: data.language,
      topics: data.topics ?? [],
      defaultBranch: data.default_branch,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      isPrivate: data.private,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at,
      htmlUrl: data.html_url,
      license: data.license?.spdx_id ?? null,
    };
  }

  private async fetchReadme(
    owner: string,
    repo: string,
    token?: string
  ): Promise<string> {
    const data = await this.githubFetch(`/repos/${owner}/${repo}/readme`, token);

    if (data.encoding === 'base64' && data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      // Truncate very long READMEs to keep token usage reasonable
      return content.length > 10000
        ? content.slice(0, 10000) + '\n\n[...truncated]'
        : content;
    }

    return '';
  }

  private async fetchLanguages(
    owner: string,
    repo: string,
    token?: string
  ): Promise<RepoLanguages> {
    return this.githubFetch(`/repos/${owner}/${repo}/languages`, token);
  }

  private async fetchDependencies(
    owner: string,
    repo: string,
    token?: string
  ): Promise<{ deps: Record<string, string>; file: string }> {
    // Try common dependency files in priority order
    const depFiles = [
      { path: 'package.json', parser: this.parsePackageJson },
      { path: 'requirements.txt', parser: this.parseRequirementsTxt },
      { path: 'Gemfile', parser: this.parseGemfile },
      { path: 'go.mod', parser: this.parseGoMod },
      { path: 'Cargo.toml', parser: this.parseCargoToml },
      { path: 'pyproject.toml', parser: this.parsePyprojectToml },
    ];

    for (const { path, parser } of depFiles) {
      try {
        const data = await this.githubFetch(
          `/repos/${owner}/${repo}/contents/${path}`,
          token
        );

        if (data.encoding === 'base64' && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          return { deps: parser(content), file: path };
        }
      } catch {
        // File not found, try next
        continue;
      }
    }

    return { deps: {}, file: 'none' };
  }

  private async fetchFileTree(
    owner: string,
    repo: string,
    token?: string
  ): Promise<RepoFileEntry[]> {
    // First get default branch from metadata
    const repoData = await this.githubFetch(`/repos/${owner}/${repo}`, token);
    const branch = repoData.default_branch;

    const data = await this.githubFetch(
      `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      token
    );

    const entries: RepoFileEntry[] = (data.tree ?? [])
      .slice(0, MAX_FILE_TREE_ENTRIES)
      .map((entry: { path: string; type: string; size?: number }) => ({
        path: entry.path,
        type: entry.type as 'blob' | 'tree',
        size: entry.size,
      }));

    return entries;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async githubFetch(path: string, token?: string): Promise<any> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CodeSalvage/1.0',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${GITHUB_API_BASE}${path}`, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        throw new GitHubServiceError('Repository not found or is private', 404);
      }
      if (response.status === 403) {
        throw new GitHubServiceError(
          'GitHub API rate limit exceeded. Try again later or connect your GitHub account.',
          403
        );
      }
      throw new GitHubServiceError(
        `GitHub API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.json() as Promise<any>;
  }

  // --- Dependency file parsers ---

  private parsePackageJson(content: string): Record<string, string> {
    try {
      const pkg = JSON.parse(content);
      return {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };
    } catch {
      return {};
    }
  }

  private parseRequirementsTxt(content: string): Record<string, string> {
    const deps: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [name, version] = trimmed.split(/[=<>~!]+/);
        if (name) deps[name.trim()] = version?.trim() ?? '*';
      }
    }
    return deps;
  }

  private parseGemfile(content: string): Record<string, string> {
    const deps: Record<string, string> = {};
    const gemRegex = /gem\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = gemRegex.exec(content)) !== null) {
      if (match[1]) deps[match[1]] = '*';
    }
    return deps;
  }

  private parseGoMod(content: string): Record<string, string> {
    const deps: Record<string, string> = {};
    const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/);
    if (requireBlock?.[1]) {
      for (const line of requireBlock[1].split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] && parts[1]) deps[parts[0]] = parts[1];
      }
    }
    return deps;
  }

  private parseCargoToml(content: string): Record<string, string> {
    const deps: Record<string, string> = {};
    const depSection = content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
    if (depSection?.[1]) {
      for (const line of depSection[1].split('\n')) {
        const match = line.match(/^(\S+)\s*=\s*"([^"]+)"/);
        if (match?.[1] && match[2]) deps[match[1]] = match[2];
      }
    }
    return deps;
  }

  private parsePyprojectToml(content: string): Record<string, string> {
    const deps: Record<string, string> = {};
    const depSection = content.match(
      /\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/
    );
    if (depSection?.[1]) {
      for (const line of depSection[1].split('\n')) {
        const match = line.match(/["']([^"']+)["']/);
        if (match?.[1]) {
          const [name] = match[1].split(/[=<>~!]/);
          if (name) deps[name.trim()] = '*';
        }
      }
    }
    return deps;
  }
}

export const githubService = new GitHubService();
