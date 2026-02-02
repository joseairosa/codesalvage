/**
 * New Project Page
 *
 * Multi-step form for creating a new project listing.
 * Integrates all reusable form components with React Hook Form + Zod validation.
 *
 * Features:
 * - Form validation with Zod schema
 * - File upload integration
 * - Real-time validation feedback
 * - Save as draft or publish
 * - Redirects to project detail page on success
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProjectSchema,
  type CreateProjectFormData,
} from '@/lib/validations/project';
import { TechStackSelector } from '@/components/projects/TechStackSelector';
import { PriceInput } from '@/components/projects/PriceInput';
import { CompletionSlider } from '@/components/projects/CompletionSlider';
import { CategorySelector } from '@/components/projects/CategorySelector';
import { FileUpload } from '@/components/projects/FileUpload';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, Github, Sparkles, Link2, ExternalLink, Lock, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ProjectLimitWarning } from '@/components/seller/ProjectLimitWarning';
import type { RepoAnalysisResult } from '@/lib/services/RepoAnalysisService';

const componentName = 'NewProjectPage';

export default function NewProjectPage() {
  console.log(`[${componentName}] Page rendered`);

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [uploadedScreenshots, setUploadedScreenshots] = React.useState<string[]>([]);
  const [isCheckingLimit, setIsCheckingLimit] = React.useState(true);
  const [projectLimitReached, setProjectLimitReached] = React.useState(false);
  const [projectCount, setProjectCount] = React.useState(0);
  const [githubImportUrl, setGithubImportUrl] = React.useState('');
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analyzeError, setAnalyzeError] = React.useState<string | null>(null);
  const [analyzeSuccess, setAnalyzeSuccess] = React.useState(false);
  const [githubConnected, setGithubConnected] = React.useState(false);
  const [isCheckingGithub, setIsCheckingGithub] = React.useState(true);
  const [githubRepos, setGithubRepos] = React.useState<Array<{
    fullName: string;
    name: string;
    owner: string;
    description: string | null;
    private: boolean;
    url: string;
    language: string | null;
    stars: number;
    updatedAt: string;
  }>>([]);
  const [isLoadingRepos, setIsLoadingRepos] = React.useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = React.useState('');
  const [showDescriptionPreview, setShowDescriptionPreview] = React.useState(false);

  // ============================================
  // FORM SETUP
  // ============================================

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
    reset,
  } = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'web_app',
      completionPercentage: 75,
      priceCents: 50000, // $500
      techStack: [],
      licenseType: 'full_code',
      accessLevel: 'full',
      screenshotUrls: [],
      estimatedCompletionHours: undefined,
      knownIssues: '',
      primaryLanguage: '',
      frameworks: [],
      githubUrl: '',
      githubRepoName: '',
      demoUrl: '',
      documentationUrl: '',
      demoVideoUrl: '',
    },
  });

  // Watch description length for character counter
  const description = watch('description');

  // ============================================
  // EFFECTS
  // ============================================

  /**
   * Check project limit on page load
   */
  React.useEffect(() => {
    const checkProjectLimit = async () => {
      try {
        console.log(`[${componentName}] Checking project limit`);

        // Fetch user's projects to check count
        const response = await fetch('/api/projects?status=active&limit=100');
        if (!response.ok) {
          console.error(`[${componentName}] Failed to fetch projects`);
          setIsCheckingLimit(false);
          return;
        }

        const data = await response.json();
        const activeCount = data.total || 0;
        console.log(`[${componentName}] Active project count:`, activeCount);

        setProjectCount(activeCount);

        // Check if limit reached (3 for free tier)
        // Note: Backend will also check subscription status
        if (activeCount >= 3) {
          setProjectLimitReached(true);
        }
      } catch (error) {
        console.error(`[${componentName}] Error checking project limit:`, error);
      } finally {
        setIsCheckingLimit(false);
      }
    };

    checkProjectLimit();
  }, []);

  /**
   * Fetch user's GitHub repos
   */
  const fetchGithubRepos = React.useCallback(async () => {
    setIsLoadingRepos(true);
    try {
      const response = await fetch('/api/user/github-repos');
      if (response.ok) {
        const data = await response.json();
        setGithubRepos(data.repos || []);
      }
    } catch (error) {
      console.error(`[${componentName}] Error fetching GitHub repos:`, error);
    } finally {
      setIsLoadingRepos(false);
    }
  }, []);

  /**
   * Check GitHub connection status on page load
   */
  React.useEffect(() => {
    const checkGithubStatus = async () => {
      try {
        const response = await fetch('/api/user/github-status');
        if (response.ok) {
          const data = await response.json();
          setGithubConnected(data.connected);
          if (data.connected) {
            fetchGithubRepos();
          }
        }
      } catch (error) {
        console.error(`[${componentName}] Error checking GitHub status:`, error);
      } finally {
        setIsCheckingGithub(false);
      }
    };

    // Check for github_connected query param (redirect from OAuth callback)
    const params = new URLSearchParams(window.location.search);
    if (params.get('github_connected') === 'true') {
      setGithubConnected(true);
      setIsCheckingGithub(false);
      fetchGithubRepos();
      // Clean up URL
      window.history.replaceState({}, '', '/projects/new');
    } else {
      checkGithubStatus();
    }
  }, [fetchGithubRepos]);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Handle file upload completion
   */
  const handleUploadComplete = (publicUrl: string, key: string) => {
    console.log(`[${componentName}] File uploaded:`, { publicUrl, key });

    setUploadedScreenshots((prev) => {
      const updated = [...prev, publicUrl];
      setValue('screenshotUrls', updated, { shouldValidate: true });
      return updated;
    });
  };

  /**
   * Handle file upload error
   */
  const handleUploadError = (error: Error) => {
    console.error(`[${componentName}] Upload error:`, error);
    setSubmitError(`Upload failed: ${error.message}`);
  };

  /**
   * Analyze GitHub repo with AI and pre-fill form
   */
  const handleAnalyzeRepo = async () => {
    if (!githubImportUrl.trim()) return;

    setIsAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeSuccess(false);

    try {
      const response = await fetch('/api/projects/analyze-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: githubImportUrl.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze repository');
      }

      const { analysis, repoMeta } = (await response.json()) as {
        analysis: RepoAnalysisResult;
        repoMeta: { fullName: string; htmlUrl: string };
      };

      // Pre-fill the form with AI analysis
      reset({
        title: analysis.title,
        description: analysis.description,
        category: analysis.category,
        techStack: analysis.techStack,
        primaryLanguage: analysis.primaryLanguage ?? '',
        frameworks: analysis.frameworks ?? [],
        completionPercentage: analysis.completionPercentage,
        estimatedCompletionHours: analysis.estimatedCompletionHours,
        knownIssues: analysis.knownIssues ?? '',
        priceCents: analysis.suggestedPriceCents,
        licenseType: analysis.licenseType,
        accessLevel: analysis.accessLevel,
        githubUrl: repoMeta.htmlUrl,
        githubRepoName: repoMeta.fullName,
        screenshotUrls: [],
        demoUrl: '',
        documentationUrl: '',
        demoVideoUrl: '',
      });

      setAnalyzeSuccess(true);
      console.log(
        `[${componentName}] Form pre-filled from GitHub repo:`,
        repoMeta.fullName
      );
    } catch (error) {
      console.error(`[${componentName}] GitHub analysis error:`, error);
      setAnalyzeError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Submit form as draft
   */
  const onSubmitDraft = async (data: CreateProjectFormData) => {
    console.log(`[${componentName}] Submitting as draft:`, data);

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();

        // Check if it's a project limit error
        if (
          error.field === 'plan_limit' ||
          error.message?.includes('Free plan limited to 3 active projects')
        ) {
          setProjectLimitReached(true);
          setProjectCount(3);
          return;
        }

        throw new Error(error.message || 'Failed to create project');
      }

      const project = await response.json();
      console.log(`[${componentName}] Project created as draft:`, project);

      // Redirect to seller dashboard
      router.push('/seller/projects');
    } catch (error) {
      console.error(`[${componentName}] Draft submission error:`, error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to save draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Submit form and publish
   */
  const onSubmitPublish = async (data: CreateProjectFormData) => {
    console.log(`[${componentName}] Submitting and publishing:`, data);

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Create project as draft
      const createResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();

        // Check if it's a project limit error
        if (
          error.field === 'plan_limit' ||
          error.message?.includes('Free plan limited to 3 active projects')
        ) {
          setProjectLimitReached(true);
          setProjectCount(3);
          return;
        }

        throw new Error(error.message || 'Failed to create project');
      }

      const project = await createResponse.json();
      console.log(`[${componentName}] Project created:`, project);

      // Step 2: Publish project
      const publishResponse = await fetch(`/api/projects/${project.id}/publish`, {
        method: 'POST',
      });

      if (!publishResponse.ok) {
        const error = await publishResponse.json();
        throw new Error(error.message || 'Failed to publish project');
      }

      const publishedProject = await publishResponse.json();
      console.log(`[${componentName}] Project published:`, publishedProject);

      // Redirect to project detail page
      router.push(`/projects/${publishedProject.id}`);
    } catch (error) {
      console.error(`[${componentName}] Publish submission error:`, error);
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to publish project'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  // Show loading state while checking limit
  if (isCheckingLimit) {
    return (
      <div className="container mx-auto max-w-4xl py-20">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-muted-foreground">Checking project limits...</p>
        </div>
      </div>
    );
  }

  // Show project limit warning if limit reached
  if (projectLimitReached) {
    return <ProjectLimitWarning projectCount={projectCount} />;
  }

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">List a New Project</h1>
          <p className="mt-2 text-muted-foreground">
            Sell your incomplete project to buyers who want to finish it
          </p>
        </div>

        {/* Import from GitHub */}
        <Card className="border-dashed border-purple-300 bg-gradient-to-r from-purple-50/50 to-blue-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Github className="h-5 w-5" />
                  Import from GitHub
                </CardTitle>
                <CardDescription className="mt-1">
                  {githubConnected
                    ? 'Paste a GitHub repo URL (public or private) and AI will analyze it to pre-fill the form'
                    : 'Paste a public GitHub repo URL and AI will analyze it to pre-fill the form'}
                </CardDescription>
              </div>

              {/* GitHub connection status */}
              {!isCheckingGithub && (
                <div className="shrink-0">
                  {githubConnected ? (
                    <div className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      GitHub Connected
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.location.href = '/api/github/connect';
                      }}
                      className="gap-1.5"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Connect GitHub
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Repo selector when GitHub is connected */}
            {githubConnected && (
              <div className="mb-3">
                {isLoadingRepos ? (
                  <div className="flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading your repositories...
                  </div>
                ) : githubRepos.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Select a repository</Label>
                    <Input
                      placeholder="Search repositories..."
                      value={repoSearchQuery}
                      onChange={(e) => setRepoSearchQuery(e.target.value)}
                      className="mb-1.5 h-8 text-sm"
                    />
                    <div className="max-h-48 overflow-y-auto rounded-md border bg-white">
                      {githubRepos
                        .filter((repo) => {
                          if (!repoSearchQuery.trim()) return true;
                          const q = repoSearchQuery.toLowerCase();
                          return (
                            repo.fullName.toLowerCase().includes(q) ||
                            repo.description?.toLowerCase().includes(q) ||
                            repo.language?.toLowerCase().includes(q)
                          );
                        })
                        .map((repo) => (
                        <button
                          key={repo.fullName}
                          type="button"
                          onClick={() => {
                            setGithubImportUrl(repo.url);
                            setAnalyzeError(null);
                            setAnalyzeSuccess(false);
                          }}
                          className={`flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-purple-50 ${
                            githubImportUrl === repo.url ? 'bg-purple-50 ring-1 ring-inset ring-purple-300' : ''
                          }`}
                        >
                          {repo.private ? (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          ) : (
                            <Globe className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{repo.fullName}</div>
                            {repo.description && (
                              <div className="truncate text-xs text-muted-foreground">{repo.description}</div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            {repo.language && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5">{repo.language}</span>
                            )}
                          </div>
                        </button>
                      ))}
                      {repoSearchQuery.trim() &&
                        !githubRepos.some((repo) => {
                          const q = repoSearchQuery.toLowerCase();
                          return (
                            repo.fullName.toLowerCase().includes(q) ||
                            repo.description?.toLowerCase().includes(q) ||
                            repo.language?.toLowerCase().includes(q)
                          );
                        }) && (
                          <div className="px-3 py-3 text-center text-sm text-muted-foreground">
                            No repositories match &quot;{repoSearchQuery}&quot;
                          </div>
                        )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* URL input + Analyze button */}
            <div className="flex gap-2">
              <Input
                placeholder="https://github.com/owner/repo"
                value={githubImportUrl}
                onChange={(e) => setGithubImportUrl(e.target.value)}
                disabled={isAnalyzing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAnalyzeRepo();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAnalyzeRepo}
                disabled={isAnalyzing || !githubImportUrl.trim()}
                className="shrink-0"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze
                  </>
                )}
              </Button>
            </div>

            {!githubConnected && !isCheckingGithub && (
              <p className="mt-2 text-xs text-muted-foreground">
                Want to import a private repo?{' '}
                <a
                  href="/api/github/connect"
                  className="font-medium text-blue-600 hover:underline"
                >
                  Connect your GitHub account
                  <ExternalLink className="ml-0.5 inline h-3 w-3" />
                </a>
              </p>
            )}

            {analyzeError && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {analyzeError}
              </div>
            )}

            {analyzeSuccess && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Form pre-filled from repository analysis. Review the fields below and edit
                as needed.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Alert */}
        {submitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <form className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Tell buyers about your project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Project Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., E-commerce Dashboard with Analytics"
                  {...register('title')}
                  className={errors.title ? 'border-destructive' : ''}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-1 rounded-md border p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowDescriptionPreview(false)}
                      className={`rounded px-2 py-1 transition-colors ${
                        !showDescriptionPreview
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDescriptionPreview(true)}
                      className={`rounded px-2 py-1 transition-colors ${
                        showDescriptionPreview
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>
                {showDescriptionPreview ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-muted/30 p-4 min-h-[10rem]">
                    {description ? (
                      <ReactMarkdown>{description}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground italic">Nothing to preview</p>
                    )}
                  </div>
                ) : (
                  <Textarea
                    id="description"
                    placeholder="Describe your project in detail using Markdown. What does it do? What's implemented? What needs to be finished?"
                    rows={8}
                    {...register('description')}
                    className={errors.description ? 'border-destructive' : ''}
                  />
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{errors.description?.message || 'Supports Markdown — minimum 50 characters'}</span>
                  <span>{description?.length || 0} / 5000 characters</span>
                </div>
              </div>

              {/* Category */}
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <CategorySelector
                    value={field.value}
                    onChange={field.onChange}
                    {...(errors.category?.message && { error: errors.category.message })}
                  />
                )}
              />
            </CardContent>
          </Card>

          {/* Technical Details */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Details</CardTitle>
              <CardDescription>What technologies are used?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tech Stack */}
              <Controller
                name="techStack"
                control={control}
                render={({ field }) => (
                  <TechStackSelector
                    value={field.value}
                    onChange={field.onChange}
                    {...(errors.techStack?.message && {
                      error: errors.techStack.message,
                    })}
                  />
                )}
              />

              {/* Primary Language */}
              <div className="space-y-2">
                <Label htmlFor="primaryLanguage">Primary Language (Optional)</Label>
                <Input
                  id="primaryLanguage"
                  placeholder="e.g., TypeScript, Python, Go"
                  {...register('primaryLanguage')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Completion Status */}
          <Card>
            <CardHeader>
              <CardTitle>Completion Status</CardTitle>
              <CardDescription>How complete is your project?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Completion Percentage */}
              <Controller
                name="completionPercentage"
                control={control}
                render={({ field }) => (
                  <CompletionSlider
                    value={field.value}
                    onChange={field.onChange}
                    {...(errors.completionPercentage?.message && {
                      error: errors.completionPercentage.message,
                    })}
                  />
                )}
              />

              {/* Estimated Completion Hours */}
              <div className="space-y-2">
                <Label htmlFor="estimatedCompletionHours">
                  Estimated Hours to Finish (Optional)
                </Label>
                <Input
                  id="estimatedCompletionHours"
                  type="number"
                  placeholder="e.g., 40"
                  {...register('estimatedCompletionHours', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Your estimate of how many hours are needed to complete the project
                </p>
              </div>

              {/* Known Issues */}
              <div className="space-y-2">
                <Label htmlFor="knownIssues">Known Issues (Optional)</Label>
                <Textarea
                  id="knownIssues"
                  placeholder="List any bugs, missing features, or technical debt"
                  rows={4}
                  {...register('knownIssues')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Licensing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Licensing</CardTitle>
              <CardDescription>Set your price and license terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Price */}
              <Controller
                name="priceCents"
                control={control}
                render={({ field }) => (
                  <PriceInput
                    value={field.value}
                    onChange={field.onChange}
                    {...(errors.priceCents?.message && {
                      error: errors.priceCents.message,
                    })}
                  />
                )}
              />

              {/* License Type */}
              <div className="space-y-2">
                <Label htmlFor="licenseType">
                  License Type <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="licenseType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="licenseType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_code">
                          Full Code License - Buyer owns all code
                        </SelectItem>
                        <SelectItem value="limited">
                          Limited License - Buyer can use but not resell
                        </SelectItem>
                        <SelectItem value="custom">
                          Custom License - Negotiable terms
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Access Level */}
              <div className="space-y-2">
                <Label htmlFor="accessLevel">
                  Access Level <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="accessLevel"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="accessLevel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">
                          Full Access - Complete source code and assets
                        </SelectItem>
                        <SelectItem value="read_only">
                          Read-Only - View code, limited modification
                        </SelectItem>
                        <SelectItem value="zip_download">
                          ZIP Download - One-time code download
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Media & Links */}
          <Card>
            <CardHeader>
              <CardTitle>Media & Links</CardTitle>
              <CardDescription>
                Add screenshots, demos, and repository links
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Screenshots */}
              <div className="space-y-2">
                <Label>Screenshots (Recommended)</Label>
                <FileUpload
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                  label="Upload Screenshots"
                  fileType="image"
                  multiple={true}
                  maxSizeMB={10}
                />
                {uploadedScreenshots.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {uploadedScreenshots.length} screenshot(s) uploaded
                  </p>
                )}
              </div>

              {/* GitHub URL */}
              <div className="space-y-2">
                <Label htmlFor="githubUrl">GitHub Repository (Optional)</Label>
                <Input
                  id="githubUrl"
                  type="url"
                  placeholder="https://github.com/username/repo"
                  {...register('githubUrl')}
                  className={errors.githubUrl ? 'border-destructive' : ''}
                />
                {errors.githubUrl && (
                  <p className="text-xs text-destructive">{errors.githubUrl.message}</p>
                )}
              </div>

              {/* Demo URL */}
              <div className="space-y-2">
                <Label htmlFor="demoUrl">Live Demo URL (Optional)</Label>
                <Input
                  id="demoUrl"
                  type="url"
                  placeholder="https://demo.example.com"
                  {...register('demoUrl')}
                  className={errors.demoUrl ? 'border-destructive' : ''}
                />
              </div>

              {/* Documentation URL */}
              <div className="space-y-2">
                <Label htmlFor="documentationUrl">Documentation URL (Optional)</Label>
                <Input
                  id="documentationUrl"
                  type="url"
                  placeholder="https://docs.example.com"
                  {...register('documentationUrl')}
                  className={errors.documentationUrl ? 'border-destructive' : ''}
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleSubmit(onSubmitDraft)}
                disabled={isSubmitting || !isDirty}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save as Draft'
                )}
              </Button>

              <Button
                type="button"
                onClick={handleSubmit(onSubmitPublish)}
                disabled={isSubmitting || !isDirty}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Publish Project
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
