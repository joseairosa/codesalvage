/**
 * Offer Validation Schemas
 *
 * Zod schemas for validating offer creation, counter-offers, and rejections.
 *
 * @example
 * import { createOfferSchema } from '@/lib/validations/offer';
 * const result = createOfferSchema.safeParse(data);
 */

import { z } from 'zod';

/** Hard minimum: $10 (1000 cents) */
export const MINIMUM_OFFER_CENTS = 1000;

/** Offers expire after 7 days */
export const OFFER_EXPIRY_DAYS = 7;

export const OFFER_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'countered',
  'withdrawn',
  'expired',
] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];

/**
 * Schema for creating a new offer (buyer → seller)
 */
export const createOfferSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  offeredPriceCents: z
    .number()
    .int('Offer must be a whole number of cents')
    .min(MINIMUM_OFFER_CENTS, `Offer must be at least $${MINIMUM_OFFER_CENTS / 100}`),
  message: z
    .string()
    .max(1000, 'Message must be less than 1000 characters')
    .trim()
    .optional()
    .or(z.literal('')),
});

export type CreateOfferFormData = z.infer<typeof createOfferSchema>;

/**
 * Schema for counter-offering (seller → buyer or buyer → seller)
 */
export const counterOfferSchema = z.object({
  counterPriceCents: z
    .number()
    .int('Counter-offer must be a whole number of cents')
    .min(MINIMUM_OFFER_CENTS, `Counter-offer must be at least $${MINIMUM_OFFER_CENTS / 100}`),
  message: z
    .string()
    .max(1000, 'Message must be less than 1000 characters')
    .trim()
    .optional()
    .or(z.literal('')),
});

export type CounterOfferFormData = z.infer<typeof counterOfferSchema>;

/**
 * Schema for rejecting an offer
 */
export const rejectOfferSchema = z.object({
  reason: z
    .string()
    .max(500, 'Reason must be less than 500 characters')
    .trim()
    .optional()
    .or(z.literal('')),
});

export type RejectOfferFormData = z.infer<typeof rejectOfferSchema>;
