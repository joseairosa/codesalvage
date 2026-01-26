/**
 * Project Validation Schemas
 *
 * Zod schemas for validating project data on the client-side.
 * Matches the server-side validation in ProjectService.
 *
 * @example
 * import { createProjectSchema } from '@/lib/validations/project';
 * const result = createProjectSchema.safeParse(data);
 */

import { z } from 'zod';

/**
 * Valid project categories
 */
export const PROJECT_CATEGORIES = [
  'web_app',
  'mobile_app',
  'desktop_app',
  'backend_api',
  'cli_tool',
  'library',
  'dashboard',
  'game',
  'other',
] as const;

/**
 * Valid license types
 */
export const LICENSE_TYPES = ['full_code', 'limited', 'custom'] as const;

/**
 * Valid access levels
 */
export const ACCESS_LEVELS = ['full', 'read_only', 'zip_download'] as const;

/**
 * Create Project Schema
 *
 * Validates project creation data with the same rules as ProjectService:
 * - Title: 5-100 characters
 * - Description: 50-5000 characters
 * - Completion: 50-95%
 * - Price: $100-$100,000 (10000-10000000 cents)
 * - Tech stack: 1-20 technologies
 */
export const createProjectSchema = z.object({
  // Basic Information
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title must be less than 100 characters')
    .trim(),

  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(5000, 'Description must be less than 5000 characters')
    .trim(),

  category: z.enum(PROJECT_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a valid category' }),
  }),

  // Completion Details
  completionPercentage: z
    .number()
    .int('Completion percentage must be a whole number')
    .min(50, 'Project must be at least 50% complete')
    .max(95, 'Project cannot be more than 95% complete'),

  estimatedCompletionHours: z.number().int().positive().optional(),

  knownIssues: z.string().max(2000, 'Known issues must be less than 2000 characters').optional(),

  // Pricing
  priceCents: z
    .number()
    .int('Price must be a whole number')
    .min(10000, 'Price must be at least $100')
    .max(10000000, 'Price cannot exceed $100,000'),

  // Licensing
  licenseType: z.enum(LICENSE_TYPES, {
    errorMap: () => ({ message: 'Please select a valid license type' }),
  }),

  accessLevel: z.enum(ACCESS_LEVELS, {
    errorMap: () => ({ message: 'Please select a valid access level' }),
  }),

  // Technical Details
  techStack: z
    .array(z.string())
    .min(1, 'At least one technology is required')
    .max(20, 'Maximum 20 technologies allowed'),

  primaryLanguage: z.string().max(50).optional(),

  frameworks: z.array(z.string()).max(10).optional(),

  // Links & Media
  githubUrl: z
    .string()
    .url('Invalid URL format')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return (
            parsed.hostname === 'github.com' && parsed.pathname.split('/').filter(Boolean).length >= 2
          );
        } catch {
          return false;
        }
      },
      { message: 'Must be a valid GitHub repository URL' }
    )
    .optional()
    .or(z.literal('')),

  githubRepoName: z.string().max(100).optional(),

  demoUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),

  documentationUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),

  thumbnailImageUrl: z.string().url().optional(),

  screenshotUrls: z.array(z.string().url()).max(10, 'Maximum 10 screenshots allowed').default([]),

  demoVideoUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
});

/**
 * Type for create project form data
 */
export type CreateProjectFormData = z.infer<typeof createProjectSchema>;

/**
 * Update Project Schema
 *
 * Allows partial updates to project data
 */
export const updateProjectSchema = createProjectSchema.partial();

/**
 * Type for update project form data
 */
export type UpdateProjectFormData = z.infer<typeof updateProjectSchema>;
