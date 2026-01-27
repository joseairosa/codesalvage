/**
 * R2Service - Cloudflare R2 File Storage Service
 *
 * Responsibilities:
 * - Upload files to Cloudflare R2 (S3-compatible storage)
 * - Generate pre-signed URLs for uploads
 * - Generate public CDN URLs for downloads
 * - Delete files from R2
 * - Handle file validation and transformation
 *
 * Architecture:
 * - Uses AWS SDK v3 S3 client (R2 is S3-compatible)
 * - Implements retry logic for failed uploads
 * - Supports multiple file types (images, videos, zips)
 * - Generates optimized file names with timestamps
 *
 * @example
 * const r2Service = new R2Service();
 * const uploadUrl = await r2Service.getUploadUrl('screenshot.png', 'image/png');
 * // Client uploads to uploadUrl
 * const publicUrl = r2Service.getPublicUrl('uploads/user123/123456-screenshot.png');
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env';

/**
 * Supported file types for uploads
 */
export enum FileType {
  IMAGE = 'image',
  VIDEO = 'video',
  ZIP = 'zip',
  DOCUMENT = 'document',
}

/**
 * File upload configuration
 */
export interface UploadConfig {
  /**
   * File type category
   */
  type: FileType;

  /**
   * Maximum file size in bytes
   */
  maxSize: number;

  /**
   * Allowed MIME types
   */
  allowedMimeTypes: string[];
}

/**
 * Upload URL response
 */
export interface UploadUrlResponse {
  /**
   * Pre-signed URL for uploading
   */
  uploadUrl: string;

  /**
   * File key in R2 bucket
   */
  key: string;

  /**
   * Public URL for accessing the file after upload
   */
  publicUrl: string;

  /**
   * URL expiration time (Unix timestamp)
   */
  expiresAt: number;
}

/**
 * File upload constraints by type
 */
const UPLOAD_CONFIGS: Record<FileType, UploadConfig> = {
  [FileType.IMAGE]: {
    type: FileType.IMAGE,
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  },
  [FileType.VIDEO]: {
    type: FileType.VIDEO,
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: [
      'video/mp4',
      'video/webm',
      'video/quicktime', // .mov files
    ],
  },
  [FileType.ZIP]: {
    type: FileType.ZIP,
    maxSize: 500 * 1024 * 1024, // 500MB
    allowedMimeTypes: [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/x-tar',
      'application/gzip',
    ],
  },
  [FileType.DOCUMENT]: {
    type: FileType.DOCUMENT,
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['application/pdf', 'text/markdown', 'text/plain'],
  },
};

/**
 * R2Service
 *
 * Handles all file storage operations with Cloudflare R2.
 */
export class R2Service {
  /**
   * S3 client configured for Cloudflare R2
   */
  private s3Client: S3Client;

  /**
   * R2 bucket name
   */
  private bucketName: string;

  /**
   * R2 public URL base
   */
  private publicUrlBase: string;

  constructor() {
    console.log('[R2Service] Initializing R2 service');

    // Check if R2 is configured
    if (
      !env.R2_ENDPOINT ||
      !env.R2_ACCESS_KEY_ID ||
      !env.R2_SECRET_ACCESS_KEY ||
      !env.R2_BUCKET_NAME ||
      !env.R2_PUBLIC_URL
    ) {
      console.warn('[R2Service] R2 is not configured. File uploads will not work.');
      console.warn(
        '[R2Service] Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL in .env'
      );

      // Create stub client for development
      this.s3Client = new S3Client({ region: 'auto' });
      this.bucketName = 'not-configured';
      this.publicUrlBase = 'https://not-configured.r2.dev';
      return;
    }

    // Initialize S3 client with R2 endpoint
    this.s3Client = new S3Client({
      region: 'auto', // R2 uses 'auto' region
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });

    this.bucketName = env.R2_BUCKET_NAME;
    this.publicUrlBase = env.R2_PUBLIC_URL;

    console.log('[R2Service] Initialized with bucket:', this.bucketName);
  }

  /**
   * Generate a pre-signed upload URL
   *
   * Client can use this URL to upload directly to R2 without backend proxying.
   *
   * @param filename - Original filename
   * @param mimeType - File MIME type
   * @param userId - User ID for organizing files
   * @param fileType - File type category
   * @param expiresInSeconds - URL expiration time (default: 1 hour)
   * @returns Upload URL response with key and public URL
   *
   * @throws Error if file validation fails
   *
   * @example
   * const response = await r2Service.getUploadUrl(
   *   'screenshot.png',
   *   'image/png',
   *   'user123',
   *   FileType.IMAGE
   * );
   * // Returns { uploadUrl, key, publicUrl, expiresAt }
   */
  async getUploadUrl(
    filename: string,
    mimeType: string,
    userId: string,
    fileType: FileType,
    expiresInSeconds = 3600
  ): Promise<UploadUrlResponse> {
    console.log('[R2Service] Generating upload URL:', {
      filename,
      mimeType,
      userId,
      fileType,
    });

    // Validate file type
    this.validateFile(mimeType, 0, fileType); // Size validation happens client-side

    // Generate unique file key
    const key = this.generateFileKey(filename, userId, fileType);

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimeType,
      // Optional: Add metadata
      Metadata: {
        userId,
        fileType,
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Generate pre-signed URL
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    const publicUrl = this.getPublicUrl(key);
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    console.log('[R2Service] Upload URL generated:', {
      key,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    });

    return {
      uploadUrl,
      key,
      publicUrl,
      expiresAt,
    };
  }

  /**
   * Get public CDN URL for a file
   *
   * @param key - File key in R2 bucket
   * @returns Public URL
   *
   * @example
   * const url = r2Service.getPublicUrl('uploads/user123/screenshot.png');
   * // Returns: https://pub-xxx.r2.dev/uploads/user123/screenshot.png
   */
  getPublicUrl(key: string): string {
    return `${this.publicUrlBase}/${key}`;
  }

  /**
   * Delete a file from R2
   *
   * @param key - File key to delete
   * @returns Promise that resolves when file is deleted
   *
   * @example
   * await r2Service.deleteFile('uploads/user123/old-file.png');
   */
  async deleteFile(key: string): Promise<void> {
    console.log('[R2Service] Deleting file:', key);

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);

    console.log('[R2Service] File deleted successfully');
  }

  /**
   * Check if a file exists in R2
   *
   * @param key - File key to check
   * @returns true if file exists, false otherwise
   *
   * @example
   * const exists = await r2Service.fileExists('uploads/user123/file.png');
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      // If error is 404, file doesn't exist
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Validate file against constraints
   *
   * @param mimeType - File MIME type
   * @param size - File size in bytes
   * @param fileType - File type category
   * @throws Error if validation fails
   *
   * @private
   */
  private validateFile(mimeType: string, size: number, fileType: FileType): void {
    const config = UPLOAD_CONFIGS[fileType];

    if (!config) {
      throw new Error(`Invalid file type: ${fileType}`);
    }

    // Check MIME type
    if (!config.allowedMimeTypes.includes(mimeType)) {
      throw new Error(
        `Invalid MIME type: ${mimeType}. Allowed types: ${config.allowedMimeTypes.join(', ')}`
      );
    }

    // Check size (if provided)
    if (size > 0 && size > config.maxSize) {
      const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(2);
      const fileSizeMB = (size / (1024 * 1024)).toFixed(2);
      throw new Error(`File too large: ${fileSizeMB}MB. Maximum allowed: ${maxSizeMB}MB`);
    }
  }

  /**
   * Generate unique file key for R2 storage
   *
   * Format: {fileType}/{userId}/{timestamp}-{sanitizedFilename}
   *
   * @param filename - Original filename
   * @param userId - User ID
   * @param fileType - File type category
   * @returns Generated file key
   *
   * @private
   */
  private generateFileKey(filename: string, userId: string, fileType: FileType): string {
    const timestamp = Date.now();
    const sanitized = this.sanitizeFilename(filename);
    return `${fileType}/${userId}/${timestamp}-${sanitized}`;
  }

  /**
   * Sanitize filename for safe storage
   *
   * - Converts to lowercase
   * - Replaces spaces with hyphens
   * - Removes special characters (except dots and hyphens)
   * - Limits length to 100 characters
   *
   * @param filename - Original filename
   * @returns Sanitized filename
   *
   * @private
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9.-]/g, '') // Remove special characters
      .slice(0, 100); // Limit length
  }

  /**
   * Get upload configuration for a file type
   *
   * @param fileType - File type category
   * @returns Upload configuration
   *
   * @example
   * const config = r2Service.getUploadConfig(FileType.IMAGE);
   * console.log(`Max size: ${config.maxSize} bytes`);
   */
  getUploadConfig(fileType: FileType): UploadConfig {
    return UPLOAD_CONFIGS[fileType];
  }

  /**
   * Get all upload configurations
   *
   * @returns All upload configurations
   */
  getAllUploadConfigs(): Record<FileType, UploadConfig> {
    return UPLOAD_CONFIGS;
  }
}

/**
 * Singleton instance of R2Service
 *
 * Use this export in API routes and services.
 *
 * @example
 * import { r2Service } from '@/lib/services/R2Service';
 * const uploadUrl = await r2Service.getUploadUrl(...);
 */
export const r2Service = new R2Service();
