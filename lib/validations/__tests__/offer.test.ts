import { describe, it, expect } from 'vitest';
import {
  createOfferSchema,
  counterOfferSchema,
  rejectOfferSchema,
  MINIMUM_OFFER_CENTS,
  OFFER_STATUSES,
} from '../offer';

describe('Offer Validation Schemas', () => {
  describe('createOfferSchema', () => {
    it('should accept valid offer data', () => {
      const result = createOfferSchema.safeParse({
        projectId: 'proj_abc123',
        offeredPriceCents: 5000,
        message: 'I would like to buy this project.',
      });

      expect(result.success).toBe(true);
    });

    it('should reject missing projectId', () => {
      const result = createOfferSchema.safeParse({
        offeredPriceCents: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['projectId'] }),
        ])
      );
    });

    it('should reject empty projectId', () => {
      const result = createOfferSchema.safeParse({
        projectId: '',
        offeredPriceCents: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['projectId'] }),
        ])
      );
    });

    it('should reject offeredPriceCents below minimum ($10 = 1000 cents)', () => {
      const result = createOfferSchema.safeParse({
        projectId: 'proj_abc123',
        offeredPriceCents: 999,
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['offeredPriceCents'] }),
        ])
      );
    });

    it('should reject non-integer offeredPriceCents', () => {
      const result = createOfferSchema.safeParse({
        projectId: 'proj_abc123',
        offeredPriceCents: 1500.5,
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['offeredPriceCents'] }),
        ])
      );
    });

    it('should accept offer without message', () => {
      const result = createOfferSchema.safeParse({
        projectId: 'proj_abc123',
        offeredPriceCents: 2000,
      });

      expect(result.success).toBe(true);
    });

    it('should accept offer with empty string message', () => {
      const result = createOfferSchema.safeParse({
        projectId: 'proj_abc123',
        offeredPriceCents: 2000,
        message: '',
      });

      expect(result.success).toBe(true);
    });

    it('should reject message over 1000 characters', () => {
      const result = createOfferSchema.safeParse({
        projectId: 'proj_abc123',
        offeredPriceCents: 2000,
        message: 'a'.repeat(1001),
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['message'] }),
        ])
      );
    });

    it('should trim message whitespace', () => {
      const result = createOfferSchema.safeParse({
        projectId: 'proj_abc123',
        offeredPriceCents: 2000,
        message: '  Hello, I am interested in this project.  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe(
          'Hello, I am interested in this project.'
        );
      }
    });
  });

  describe('counterOfferSchema', () => {
    it('should accept valid counter-offer', () => {
      const result = counterOfferSchema.safeParse({
        counterPriceCents: 3000,
        message: 'How about this price instead?',
      });

      expect(result.success).toBe(true);
    });

    it('should reject counterPriceCents below minimum', () => {
      const result = counterOfferSchema.safeParse({
        counterPriceCents: 500,
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['counterPriceCents'] }),
        ])
      );
    });

    it('should reject non-integer counterPriceCents', () => {
      const result = counterOfferSchema.safeParse({
        counterPriceCents: 2000.75,
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['counterPriceCents'] }),
        ])
      );
    });

    it('should accept without message', () => {
      const result = counterOfferSchema.safeParse({
        counterPriceCents: 4000,
      });

      expect(result.success).toBe(true);
    });

    it('should reject message over 1000 characters', () => {
      const result = counterOfferSchema.safeParse({
        counterPriceCents: 4000,
        message: 'b'.repeat(1001),
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['message'] }),
        ])
      );
    });
  });

  describe('rejectOfferSchema', () => {
    it('should accept valid rejection with reason', () => {
      const result = rejectOfferSchema.safeParse({
        reason: 'The price is too low for this project.',
      });

      expect(result.success).toBe(true);
    });

    it('should accept rejection without reason', () => {
      const result = rejectOfferSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it('should accept rejection with empty string reason', () => {
      const result = rejectOfferSchema.safeParse({
        reason: '',
      });

      expect(result.success).toBe(true);
    });

    it('should reject reason over 500 characters', () => {
      const result = rejectOfferSchema.safeParse({
        reason: 'c'.repeat(501),
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['reason'] }),
        ])
      );
    });
  });

  describe('Constants', () => {
    it('MINIMUM_OFFER_CENTS should be 1000', () => {
      expect(MINIMUM_OFFER_CENTS).toBe(1000);
    });

    it('OFFER_STATUSES should contain all 6 statuses', () => {
      expect(OFFER_STATUSES).toHaveLength(6);
      expect(OFFER_STATUSES).toContain('pending');
      expect(OFFER_STATUSES).toContain('accepted');
      expect(OFFER_STATUSES).toContain('rejected');
      expect(OFFER_STATUSES).toContain('countered');
      expect(OFFER_STATUSES).toContain('withdrawn');
      expect(OFFER_STATUSES).toContain('expired');
    });
  });
});
