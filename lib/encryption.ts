/**
 * Encryption Utilities
 *
 * Responsibilities:
 * - AES-256-GCM encryption for sensitive tokens (GitHub OAuth tokens)
 * - Deterministic encrypt/decrypt with random IV per encryption
 *
 * Architecture:
 * - Uses Node.js crypto module (no external dependencies)
 * - AES-256-GCM provides authenticated encryption
 * - Random 12-byte IV per encryption for security
 * - Output format: base64(iv:ciphertext:authTag)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env['GITHUB_TOKEN_ENCRYPTION_KEY'];
  if (!key) {
    throw new Error(
      "GITHUB_TOKEN_ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error(
      'GITHUB_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
    );
  }

  return keyBuffer;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @returns Base64-encoded string containing IV + ciphertext + auth tag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine IV + ciphertext + authTag and base64 encode
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext.
 *
 * @param ciphertext Base64-encoded string from encrypt()
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
