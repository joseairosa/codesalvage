/**
 * R2Service Unit Tests
 *
 * Tests file validation, pre-signed URL generation, and Cloudflare R2 integration.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { R2Service, FileType } from '../R2Service';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-presigned-url.com'),
}));

// Mock environment config
vi.mock('@/config/env', () => ({
  env: {
    R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL: 'https://pub-test.r2.dev',
  },
}));

describe('R2Service', () => {
  let r2Service: R2Service;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create fresh instance
    r2Service = new R2Service();
  });

  // ============================================
  // UPLOAD CONFIG TESTS
  // ============================================

  describe('getUploadConfig', () => {
    it('should return config for image uploads', () => {
      const config = r2Service.getUploadConfig(FileType.IMAGE);
      expect(config).toHaveProperty('type', FileType.IMAGE);
      expect(config).toHaveProperty('maxSize', 10 * 1024 * 1024); // 10MB
      expect(config.allowedMimeTypes).toContain('image/jpeg');
      expect(config.allowedMimeTypes).toContain('image/png');
    });

    it('should return config for video uploads', () => {
      const config = r2Service.getUploadConfig(FileType.VIDEO);
      expect(config).toHaveProperty('type', FileType.VIDEO);
      expect(config).toHaveProperty('maxSize', 100 * 1024 * 1024); // 100MB
      expect(config.allowedMimeTypes).toContain('video/mp4');
    });

    it('should return config for ZIP uploads', () => {
      const config = r2Service.getUploadConfig(FileType.ZIP);
      expect(config).toHaveProperty('type', FileType.ZIP);
      expect(config).toHaveProperty('maxSize', 500 * 1024 * 1024); // 500MB
      expect(config.allowedMimeTypes).toContain('application/zip');
    });

    it('should return config for document uploads', () => {
      const config = r2Service.getUploadConfig(FileType.DOCUMENT);
      expect(config).toHaveProperty('type', FileType.DOCUMENT);
      expect(config).toHaveProperty('maxSize', 10 * 1024 * 1024); // 10MB
      expect(config.allowedMimeTypes).toContain('application/pdf');
    });
  });

  describe('getAllUploadConfigs', () => {
    it('should return all upload configurations', () => {
      const configs = r2Service.getAllUploadConfigs();
      expect(configs).toHaveProperty(FileType.IMAGE);
      expect(configs).toHaveProperty(FileType.VIDEO);
      expect(configs).toHaveProperty(FileType.ZIP);
      expect(configs).toHaveProperty(FileType.DOCUMENT);
    });
  });

  // ============================================
  // UPLOAD URL GENERATION TESTS
  // ============================================

  describe('getUploadUrl', () => {
    it('should generate upload URL with valid parameters', async () => {
      const result = await r2Service.getUploadUrl(
        'test-image.jpg',
        'image/jpeg',
        'user123',
        FileType.IMAGE
      );

      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('publicUrl');
      expect(result).toHaveProperty('expiresAt');

      expect(result.uploadUrl).toBe('https://mock-presigned-url.com');
      expect(result.key).toContain('user123');
      expect(result.key).toContain('test-image.jpg');
      expect(result.publicUrl).toContain('https://pub-test.r2.dev');
    });

    it('should generate unique keys for same filename', async () => {
      const result1 = await r2Service.getUploadUrl(
        'test.jpg',
        'image/jpeg',
        'user123',
        FileType.IMAGE
      );

      // Wait a tiny bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result2 = await r2Service.getUploadUrl(
        'test.jpg',
        'image/jpeg',
        'user123',
        FileType.IMAGE
      );

      expect(result1.key).not.toBe(result2.key);
    });

    it('should organize files by type in key path', async () => {
      const imageResult = await r2Service.getUploadUrl(
        'test.jpg',
        'image/jpeg',
        'user123',
        FileType.IMAGE
      );

      const videoResult = await r2Service.getUploadUrl(
        'test.mp4',
        'video/mp4',
        'user123',
        FileType.VIDEO
      );

      expect(imageResult.key).toContain('image/');
      expect(videoResult.key).toContain('video/');
    });

    it('should include userId in key path', async () => {
      const result = await r2Service.getUploadUrl(
        'test.jpg',
        'image/jpeg',
        'user123',
        FileType.IMAGE
      );

      expect(result.key).toContain('user123');
    });

    it('should set expiration time in seconds', async () => {
      const beforeTime = Math.floor(Date.now() / 1000); // Convert to seconds

      const result = await r2Service.getUploadUrl(
        'test.jpg',
        'image/jpeg',
        'user123',
        FileType.IMAGE,
        3600
      );

      const afterTime = Math.floor(Date.now() / 1000); // Convert to seconds

      // expiresAt should be approximately now + 3600 seconds (in seconds, not milliseconds)
      const expectedExpiration = beforeTime + 3600;
      const tolerance = 5; // 5 second tolerance

      expect(result.expiresAt).toBeGreaterThanOrEqual(expectedExpiration - tolerance);
      expect(result.expiresAt).toBeLessThanOrEqual(afterTime + 3600 + tolerance);
    });

    it('should throw error for invalid MIME type', async () => {
      await expect(
        r2Service.getUploadUrl('test.jpg', 'image/bmp', 'user123', FileType.IMAGE)
      ).rejects.toThrow(/Invalid MIME type/);
    });

    it('should use custom expiration time', async () => {
      const customExpiration = 7200; // 2 hours
      const beforeTime = Math.floor(Date.now() / 1000); // Convert to seconds

      const result = await r2Service.getUploadUrl(
        'test.jpg',
        'image/jpeg',
        'user123',
        FileType.IMAGE,
        customExpiration
      );

      const expectedExpiration = beforeTime + customExpiration;
      const tolerance = 5; // 5 second tolerance

      expect(result.expiresAt).toBeGreaterThanOrEqual(expectedExpiration - tolerance);
      expect(result.expiresAt).toBeLessThanOrEqual(
        Math.floor(Date.now() / 1000) + customExpiration + tolerance
      );
    });
  });

  // ============================================
  // PUBLIC URL GENERATION TESTS
  // ============================================

  describe('getPublicUrl', () => {
    it('should generate public URL for a key', () => {
      const key = 'image/user123/12345-test.jpg';
      const publicUrl = r2Service.getPublicUrl(key);

      expect(publicUrl).toBe('https://pub-test.r2.dev/image/user123/12345-test.jpg');
    });
  });

});
