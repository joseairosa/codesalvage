/**
 * User Profile Validation Schema Tests
 *
 * Test Coverage:
 * - updateProfileSchema validation rules
 * - Username constraints (length, characters, required)
 * - Full name constraints (length, optional)
 * - Bio constraints (length, optional)
 * - Edge cases (empty strings, whitespace, special characters)
 */

import { describe, it, expect } from 'vitest';
import { updateProfileSchema } from '../user';

describe('updateProfileSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid profile data with all fields', () => {
      const result = updateProfileSchema.safeParse({
        fullName: 'José Airosa',
        username: 'joseairosa',
        bio: 'CTO and software engineer',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe('José Airosa');
        expect(result.data.username).toBe('joseairosa');
        expect(result.data.bio).toBe('CTO and software engineer');
      }
    });

    it('should accept empty fullName', () => {
      const result = updateProfileSchema.safeParse({
        fullName: '',
        username: 'testuser',
        bio: '',
      });

      expect(result.success).toBe(true);
    });

    it('should accept username with underscores and hyphens', () => {
      const result = updateProfileSchema.safeParse({
        username: 'test_user-123',
      });

      expect(result.success).toBe(true);
    });

    it('should accept username at minimum length (3 chars)', () => {
      const result = updateProfileSchema.safeParse({
        username: 'abc',
      });

      expect(result.success).toBe(true);
    });

    it('should accept username at maximum length (30 chars)', () => {
      const result = updateProfileSchema.safeParse({
        username: 'a'.repeat(30),
      });

      expect(result.success).toBe(true);
    });

    it('should accept optional fullName and bio', () => {
      const result = updateProfileSchema.safeParse({
        username: 'testuser',
      });

      expect(result.success).toBe(true);
    });

    it('should trim whitespace from fullName and bio', () => {
      const result = updateProfileSchema.safeParse({
        fullName: '  José Airosa  ',
        username: 'testuser',
        bio: '  Some bio  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe('José Airosa');
        expect(result.data.bio).toBe('Some bio');
      }
    });

    it('should reject username with leading/trailing spaces', () => {
      const result = updateProfileSchema.safeParse({
        username: '  testuser  ',
      });

      // Spaces fail the regex before trim applies
      expect(result.success).toBe(false);
    });
  });

  describe('username validation', () => {
    it('should reject missing username', () => {
      const result = updateProfileSchema.safeParse({
        fullName: 'Test',
      });

      expect(result.success).toBe(false);
    });

    it('should reject username shorter than 3 characters', () => {
      const result = updateProfileSchema.safeParse({
        username: 'ab',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('at least 3 characters');
      }
    });

    it('should reject username longer than 30 characters', () => {
      const result = updateProfileSchema.safeParse({
        username: 'a'.repeat(31),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('less than 30 characters');
      }
    });

    it('should reject username with spaces', () => {
      const result = updateProfileSchema.safeParse({
        username: 'test user',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('letters, numbers, underscores');
      }
    });

    it('should reject username with special characters', () => {
      const specialChars = ['test@user', 'test.user', 'test!user', 'test#user', 'test$user'];

      for (const username of specialChars) {
        const result = updateProfileSchema.safeParse({ username });
        expect(result.success).toBe(false);
      }
    });

    it('should reject empty username', () => {
      const result = updateProfileSchema.safeParse({
        username: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('fullName validation', () => {
    it('should reject fullName longer than 100 characters', () => {
      const result = updateProfileSchema.safeParse({
        fullName: 'a'.repeat(101),
        username: 'testuser',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('less than 100 characters');
      }
    });

    it('should accept fullName at exactly 100 characters', () => {
      const result = updateProfileSchema.safeParse({
        fullName: 'a'.repeat(100),
        username: 'testuser',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('bio validation', () => {
    it('should reject bio longer than 500 characters', () => {
      const result = updateProfileSchema.safeParse({
        username: 'testuser',
        bio: 'a'.repeat(501),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('less than 500 characters');
      }
    });

    it('should accept bio at exactly 500 characters', () => {
      const result = updateProfileSchema.safeParse({
        username: 'testuser',
        bio: 'a'.repeat(500),
      });

      expect(result.success).toBe(true);
    });

    it('should accept empty bio string', () => {
      const result = updateProfileSchema.safeParse({
        username: 'testuser',
        bio: '',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('type inference', () => {
    it('should produce correct types from valid data', () => {
      const result = updateProfileSchema.safeParse({
        fullName: 'Test User',
        username: 'testuser',
        bio: 'A bio',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Type check: these should all be the expected types
        const data = result.data;
        expect(typeof data.username).toBe('string');
        expect(typeof data.fullName).toBe('string');
        expect(typeof data.bio).toBe('string');
      }
    });
  });
});
