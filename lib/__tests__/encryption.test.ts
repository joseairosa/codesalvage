/**
 * Encryption Utility Tests
 *
 * Tests AES-256-GCM encrypt/decrypt round-trip and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt, decrypt } from '../encryption';

// Set a test encryption key (32 bytes = 64 hex chars)
const TEST_KEY = 'a'.repeat(64);

describe('encryption', () => {
  beforeEach(() => {
    vi.stubEnv('GITHUB_TOKEN_ENCRYPTION_KEY', TEST_KEY);
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'gho_abc123secrettoken';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same input (random IV)', () => {
      const plaintext = 'same-plaintext';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const encrypted = encrypt('');
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = 'token-with-unicode-\u00e9\u00e8\u00ea';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'x'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('error handling', () => {
    it('should throw when encryption key is missing', () => {
      vi.stubEnv('GITHUB_TOKEN_ENCRYPTION_KEY', '');

      expect(() => encrypt('test')).toThrow('GITHUB_TOKEN_ENCRYPTION_KEY is not set');
    });

    it('should throw when encryption key is wrong length', () => {
      vi.stubEnv('GITHUB_TOKEN_ENCRYPTION_KEY', 'tooshort');

      expect(() => encrypt('test')).toThrow('must be a 64-character hex string');
    });

    it('should throw when decrypting with wrong key', () => {
      const encrypted = encrypt('secret');

      // Change key
      vi.stubEnv('GITHUB_TOKEN_ENCRYPTION_KEY', 'b'.repeat(64));

      expect(() => decrypt(encrypted)).toThrow();
    });

    it('should throw when decrypting tampered ciphertext', () => {
      const encrypted = encrypt('secret');

      // Tamper with the base64 content
      const tampered =
        Buffer.from('tampered' + encrypted, 'utf-8').toString('base64');

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw when ciphertext is too short', () => {
      const tooShort = Buffer.from('abc').toString('base64');
      expect(() => decrypt(tooShort)).toThrow('too short');
    });
  });
});
