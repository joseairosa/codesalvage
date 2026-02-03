/**
 * User Profile Validation Schemas
 *
 * Zod schemas for validating user profile updates.
 *
 * @example
 * import { updateProfileSchema } from '@/lib/validations/user';
 * const result = updateProfileSchema.safeParse(data);
 */

import { z } from 'zod';

/**
 * Schema for updating user profile
 */
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .max(100, 'Full name must be less than 100 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    )
    .trim(),
  bio: z
    .string()
    .max(500, 'Bio must be less than 500 characters')
    .trim()
    .optional()
    .or(z.literal('')),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
