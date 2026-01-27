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
import { createProjectSchema, type CreateProjectFormData } from '@/lib/validations/project';
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
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

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
      setSubmitError(error instanceof Error ? error.message : 'Failed to publish project');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

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
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your project in detail. What does it do? What's implemented? What needs to be finished?"
                  rows={6}
                  {...register('description')}
                  className={errors.description ? 'border-destructive' : ''}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{errors.description?.message || 'Minimum 50 characters'}</span>
                  <span>
                    {description?.length || 0} / 5000 characters
                  </span>
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
                    error={errors.techStack?.message}
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
                    error={errors.completionPercentage?.message}
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
                    error={errors.priceCents?.message}
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
                        <SelectItem value="custom">Custom License - Negotiable terms</SelectItem>
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
              <CardDescription>Add screenshots, demos, and repository links</CardDescription>
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
