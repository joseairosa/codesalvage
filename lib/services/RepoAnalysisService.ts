/**
 * RepoAnalysisService - AI-Powered Repository Analysis
 *
 * Responsibilities:
 * - Analyze GitHub repository data using Claude API
 * - Return structured project listing data matching the create-project schema
 * - Validate AI output with Zod before returning
 *
 * Architecture:
 * - Uses Anthropic SDK (Claude) for code analysis
 * - Structured system prompt for consistent JSON output
 * - Zod validation ensures AI output matches expected schema
 * - Falls back gracefully if AI returns unexpected data
 *
 * @example
 * const service = new RepoAnalysisService();
 * const analysis = await service.analyzeRepo(repoData);
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { RepoData } from './GitHubService';

export class RepoAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepoAnalysisError';
  }
}

export const repoAnalysisSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(50).max(5000),
  category: z.enum([
    'web_app',
    'mobile_app',
    'desktop_app',
    'backend_api',
    'cli_tool',
    'library',
    'dashboard',
    'game',
    'other',
  ]),
  techStack: z.array(z.string()).min(1).max(20),
  primaryLanguage: z.string().optional(),
  frameworks: z.array(z.string()).optional(),
  completionPercentage: z.number().min(50).max(95),
  estimatedCompletionHours: z.number().min(1).optional(),
  knownIssues: z.string().optional(),
  suggestedPriceCents: z.number().min(10000).max(10000000),
  licenseType: z.enum(['full_code', 'limited', 'custom']),
  accessLevel: z.enum(['full', 'read_only', 'zip_download']),
});

export type RepoAnalysisResult = z.infer<typeof repoAnalysisSchema>;

const SYSTEM_PROMPT = `You are a code marketplace analyst for CodeSalvage, a platform where developers sell their unfinished or abandoned projects to other developers who want to continue them.

Your job is to analyze a GitHub repository and produce a structured JSON object that describes the project for a marketplace listing.

You MUST return ONLY a valid JSON object (no markdown, no explanation, no code fences) with exactly these fields:

{
  "title": "A compelling marketplace title for the project (5-100 chars, not just the repo name)",
  "description": "A detailed marketplace description in **Markdown format**. Use headings (##), bullet lists, bold, and paragraphs to structure the content. Include sections like: overview, what's been built, tech highlights, and what the buyer gets. Written in second person ('You'll get...'). (50-5000 chars)",
  "category": one of: "web_app", "mobile_app", "desktop_app", "backend_api", "cli_tool", "library", "dashboard", "game", "other",
  "techStack": ["array", "of", "technologies", "used"],
  "primaryLanguage": "The main programming language",
  "frameworks": ["major", "frameworks", "used"],
  "completionPercentage": a number from 50 to 95 reflecting how complete the project actually is,
  "estimatedCompletionHours": estimated hours a senior developer would need to finish it,
  "knownIssues": "description of any apparent issues, missing features, or technical debt visible in the repo",
  "suggestedPriceCents": price in cents (minimum 10000 = $100, maximum 10000000 = $100,000) based on complexity, completeness, and technology,
  "licenseType": "full_code" (buyer gets full ownership) or "limited" or "custom",
  "accessLevel": "full" (recommended for most cases), "read_only", or "zip_download"
}

Rules:
- completionPercentage should reflect the actual state of the code, not aspirations
- Price should reflect market value: simple projects $100-$500, moderate $500-$5000, complex $5000+
- techStack should include all significant technologies (languages, frameworks, databases, tools)
- Description MUST be formatted in Markdown with headings (##), bullet lists, and bold text for key points. Structure it with clear sections.
- Description should be marketing-quality but honest about the project's state
- If the README or code shows clear issues or TODOs, mention them in knownIssues
- Always recommend "full_code" for licenseType unless there's a reason not to
- Always recommend "full" for accessLevel unless there's a reason not to`;

export class RepoAnalysisService {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new RepoAnalysisError(
        'ANTHROPIC_API_KEY is not set. Add it to your environment variables.'
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Analyze a GitHub repository and return structured project data.
   */
  async analyzeRepo(repoData: RepoData): Promise<RepoAnalysisResult> {
    const userMessage = this.buildUserMessage(repoData);

    console.log('[RepoAnalysis] Sending repo data to Claude for analysis:', {
      repo: repoData.metadata.fullName,
      readmeLength: repoData.readme?.length ?? 0,
      languageCount: Object.keys(repoData.languages).length,
      depCount: repoData.dependencies ? Object.keys(repoData.dependencies).length : 0,
      fileCount: repoData.fileTree.length,
    });

    let response;
    try {
      response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[RepoAnalysis] Claude API error:', msg);
      throw new RepoAnalysisError(`AI analysis failed: ${msg}`);
    }

    // Extract text content from response
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new RepoAnalysisError('AI returned no text response');
    }

    // Parse JSON from response
    let parsed: unknown;
    try {
      // Strip any markdown code fences if present
      const jsonText = textBlock.text
        .replace(/^```(?:json)?\s*\n?/m, '')
        .replace(/\n?```\s*$/m, '')
        .trim();
      parsed = JSON.parse(jsonText);
    } catch {
      console.error(
        '[RepoAnalysis] Failed to parse AI response as JSON:',
        textBlock.text
      );
      throw new RepoAnalysisError('AI returned invalid JSON. Please try again.');
    }

    // Validate with Zod
    const result = repoAnalysisSchema.safeParse(parsed);
    if (!result.success) {
      console.error('[RepoAnalysis] AI output failed validation:', result.error.issues);
      throw new RepoAnalysisError(
        `AI output validation failed: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
      );
    }

    console.log('[RepoAnalysis] Analysis complete for:', repoData.metadata.fullName);
    return result.data;
  }

  private buildUserMessage(repoData: RepoData): string {
    const parts: string[] = [];

    // Repository metadata
    parts.push('## Repository Metadata');
    parts.push(`Name: ${repoData.metadata.fullName}`);
    parts.push(`Description: ${repoData.metadata.description ?? 'None'}`);
    parts.push(`Primary Language: ${repoData.metadata.language ?? 'Unknown'}`);
    parts.push(`Topics: ${repoData.metadata.topics.join(', ') || 'None'}`);
    parts.push(`Stars: ${repoData.metadata.stars}`);
    parts.push(`Forks: ${repoData.metadata.forks}`);
    parts.push(`Open Issues: ${repoData.metadata.openIssues}`);
    parts.push(`License: ${repoData.metadata.license ?? 'None'}`);
    parts.push(`Last Push: ${repoData.metadata.pushedAt}`);
    parts.push('');

    // Language breakdown
    if (Object.keys(repoData.languages).length > 0) {
      const totalBytes = Object.values(repoData.languages).reduce((a, b) => a + b, 0);
      parts.push('## Language Breakdown');
      for (const [lang, bytes] of Object.entries(repoData.languages)) {
        const pct = ((bytes / totalBytes) * 100).toFixed(1);
        parts.push(`- ${lang}: ${pct}%`);
      }
      parts.push('');
    }

    // Dependencies
    if (repoData.dependencies && Object.keys(repoData.dependencies).length > 0) {
      parts.push(`## Dependencies (from ${repoData.dependencyFile})`);
      const deps = Object.entries(repoData.dependencies);
      // Show first 50 to keep token usage reasonable
      for (const [name, version] of deps.slice(0, 50)) {
        parts.push(`- ${name}: ${version}`);
      }
      if (deps.length > 50) {
        parts.push(`... and ${deps.length - 50} more`);
      }
      parts.push('');
    }

    // README
    if (repoData.readme) {
      parts.push('## README');
      parts.push(repoData.readme);
      parts.push('');
    }

    // File tree
    if (repoData.fileTree.length > 0) {
      parts.push('## File Structure');
      for (const entry of repoData.fileTree) {
        const prefix = entry.type === 'tree' ? '/' : '';
        parts.push(`${entry.path}${prefix}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }
}

let _repoAnalysisService: RepoAnalysisService | null = null;

/**
 * Lazy singleton — only instantiated when first called,
 * so the app doesn't crash on import if ANTHROPIC_API_KEY is missing.
 */
export function getRepoAnalysisService(): RepoAnalysisService {
  if (!_repoAnalysisService) {
    _repoAnalysisService = new RepoAnalysisService();
  }
  return _repoAnalysisService;
}
