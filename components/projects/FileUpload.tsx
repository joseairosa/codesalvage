/**
 * FileUpload Component
 *
 * Handles file uploads to Cloudflare R2 with image preview and validation.
 *
 * Responsibilities:
 * - Accept drag-and-drop and click-to-upload
 * - Validate file type and size before upload
 * - Generate pre-signed URL from /api/upload
 * - Upload directly to R2 using pre-signed URL
 * - Show upload progress and image preview
 * - Return public URL for form submission
 *
 * Architecture:
 * - Client Component (uses React hooks for interactivity)
 * - Follows service pattern (API calls separated)
 * - Comprehensive error handling and logging
 *
 * @example
 * <FileUpload
 *   onUploadComplete={(url) => console.log('Uploaded:', url)}
 *   onUploadError={(error) => console.error('Error:', error)}
 *   maxSizeMB={10}
 *   acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
 * />
 */

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface FileUploadProps {
  /**
   * Callback when upload completes successfully
   * Returns the public URL of the uploaded file
   */
  onUploadComplete: (publicUrl: string, key: string) => void;

  /**
   * Callback when upload fails
   */
  onUploadError?: (error: Error) => void;

  /**
   * Maximum file size in MB (default: 10MB for images)
   */
  maxSizeMB?: number;

  /**
   * Accepted MIME types (default: images only)
   */
  acceptedTypes?: string[];

  /**
   * File type for R2 service (default: 'image')
   */
  fileType?: 'image' | 'video' | 'zip' | 'document';

  /**
   * Label for the upload button
   */
  label?: string;

  /**
   * Optional className for styling
   */
  className?: string;

  /**
   * Allow multiple file uploads
   */
  multiple?: boolean;
}

interface UploadedFile {
  file: File;
  preview: string;
  publicUrl: string;
  key: string;
  uploadProgress: number;
  error?: string;
}

interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: number;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_MAX_SIZE_MB = 10;
const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BYTES_PER_MB = 1024 * 1024;

// ============================================
// FILE UPLOAD COMPONENT
// ============================================

export function FileUpload({
  onUploadComplete,
  onUploadError,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  fileType = 'image',
  label = 'Upload Images',
  className,
  multiple = true,
}: FileUploadProps) {
  const componentName = 'FileUpload';

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  console.log(`[${componentName}] Component mounted`, {
    maxSizeMB,
    acceptedTypes,
    fileType,
    multiple,
  });

  // ============================================
  // FILE VALIDATION
  // ============================================

  /**
   * Validates file size and type
   *
   * @param file - File to validate
   * @returns Error message if invalid, null if valid
   */
  const validateFile = (file: File): string | null => {
    console.log(`[${componentName}] Validating file:`, {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      const error = `Invalid file type. Accepted types: ${acceptedTypes.join(', ')}`;
      console.error(`[${componentName}] Validation failed:`, error);
      return error;
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * BYTES_PER_MB;
    if (file.size > maxSizeBytes) {
      const error = `File too large. Maximum size: ${maxSizeMB}MB`;
      console.error(`[${componentName}] Validation failed:`, error);
      return error;
    }

    console.log(`[${componentName}] File validation passed`);
    return null;
  };

  // ============================================
  // UPLOAD LOGIC
  // ============================================

  /**
   * Uploads a file to R2
   *
   * @param file - File to upload
   */
  const uploadFile = async (file: File): Promise<void> => {
    console.log(`[${componentName}] Starting upload:`, file.name);

    // Validate file first
    const validationError = validateFile(file);
    if (validationError) {
      const error = new Error(validationError);
      if (onUploadError) {
        onUploadError(error);
      }
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.file.name === file.name ? { ...f, error: validationError } : f
        )
      );
      return;
    }

    try {
      setIsUploading(true);

      // Create preview URL for images
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';

      // Add file to uploaded files list with initial state
      const newFile: UploadedFile = {
        file,
        preview,
        publicUrl: '',
        key: '',
        uploadProgress: 0,
      };

      setUploadedFiles((prev) => [...prev, newFile]);

      console.log(`[${componentName}] Step 1: Getting pre-signed URL from /api/upload`);

      // Step 1: Get pre-signed URL from /api/upload
      const uploadUrlResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          fileType,
        }),
      });

      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json();
        throw new Error(errorData.error || 'Failed to generate upload URL');
      }

      const uploadData: UploadUrlResponse = await uploadUrlResponse.json();
      console.log(`[${componentName}] Received pre-signed URL:`, {
        key: uploadData.key,
        expiresAt: uploadData.expiresAt,
      });

      // Step 2: Upload directly to R2 using pre-signed URL
      console.log(`[${componentName}] Step 2: Uploading to R2`);

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          console.log(`[${componentName}] Upload progress:`, progress);

          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.file.name === file.name ? { ...f, uploadProgress: progress } : f
            )
          );
        }
      });

      // Handle upload completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`[${componentName}] Upload completed successfully`);

          // Update file with public URL
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.file.name === file.name
                ? {
                    ...f,
                    publicUrl: uploadData.publicUrl,
                    key: uploadData.key,
                    uploadProgress: 100,
                  }
                : f
            )
          );

          // Notify parent component
          onUploadComplete(uploadData.publicUrl, uploadData.key);
        } else {
          throw new Error(`Upload failed with status ${xhr.status}`);
        }
      });

      // Handle upload error
      xhr.addEventListener('error', () => {
        const error = new Error('Upload failed');
        console.error(`[${componentName}] Upload error:`, error);

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.file.name === file.name ? { ...f, error: 'Upload failed' } : f
          )
        );

        if (onUploadError) {
          onUploadError(error);
        }
      });

      // Start upload
      xhr.open('PUT', uploadData.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    } catch (error) {
      console.error(`[${componentName}] Upload error:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      setUploadedFiles((prev) =>
        prev.map((f) => (f.file.name === file.name ? { ...f, error: errorMessage } : f))
      );

      if (onUploadError && error instanceof Error) {
        onUploadError(error);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Handles file selection from input
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log(`[${componentName}] Files selected:`, files.length);

    const fileArray = Array.from(files);

    if (multiple) {
      fileArray.forEach((file) => uploadFile(file));
    } else {
      uploadFile(fileArray[0]!);
    }

    // Reset input value to allow re-uploading the same file
    event.target.value = '';
  };

  /**
   * Handles drag over event
   */
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  /**
   * Handles drag leave event
   */
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handles file drop
   */
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    console.log(`[${componentName}] Files dropped:`, files.length);

    const fileArray = Array.from(files);

    if (multiple) {
      fileArray.forEach((file) => uploadFile(file));
    } else {
      uploadFile(fileArray[0]!);
    }
  };

  /**
   * Handles click on upload area
   */
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Removes an uploaded file
   */
  const handleRemoveFile = (fileName: string) => {
    console.log(`[${componentName}] Removing file:`, fileName);

    setUploadedFiles((prev) => {
      const fileToRemove = prev.find((f) => f.file.name === fileName);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter((f) => f.file.name !== fileName);
    });
  };

  // ============================================
  // CLEANUP
  // ============================================

  React.useEffect(() => {
    // Cleanup preview URLs on unmount
    return () => {
      uploadedFiles.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [uploadedFiles]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={cn('space-y-4', className)}>
      {/* Label */}
      <Label>{label}</Label>

      {/* Upload Area */}
      <Card
        className={cn(
          'cursor-pointer transition-colors hover:border-primary',
          isDragging && 'border-primary bg-primary/5',
          isUploading && 'cursor-not-allowed opacity-50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <CardContent className="flex flex-col items-center justify-center py-10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mb-4 h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <p className="text-center text-sm text-muted-foreground">
            {isDragging
              ? 'Drop files here'
              : 'Drag and drop files here, or click to browse'}
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            Max {maxSizeMB}MB • {acceptedTypes.map((t) => t.split('/')[1]).join(', ')}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={acceptedTypes.join(',')}
            multiple={multiple}
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          {uploadedFiles.map((uploadedFile) => (
            <Card key={uploadedFile.file.name}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Preview */}
                  {uploadedFile.preview && (
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      <img
                        src={uploadedFile.preview}
                        alt={uploadedFile.file.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {uploadedFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(uploadedFile.file.size / BYTES_PER_MB).toFixed(2)} MB
                    </p>

                    {/* Progress */}
                    {uploadedFile.uploadProgress < 100 && !uploadedFile.error && (
                      <div className="mt-2">
                        <Progress value={uploadedFile.uploadProgress} />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Uploading... {uploadedFile.uploadProgress}%
                        </p>
                      </div>
                    )}

                    {/* Success */}
                    {uploadedFile.uploadProgress === 100 && !uploadedFile.error && (
                      <p className="mt-2 text-xs text-green-600">✓ Upload complete</p>
                    )}

                    {/* Error */}
                    {uploadedFile.error && (
                      <p className="mt-2 text-xs text-destructive">
                        ✗ {uploadedFile.error}
                      </p>
                    )}
                  </div>

                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(uploadedFile.file.name);
                    }}
                    disabled={
                      uploadedFile.uploadProgress > 0 && uploadedFile.uploadProgress < 100
                    }
                  >
                    ✕
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
