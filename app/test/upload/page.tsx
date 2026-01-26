/**
 * File Upload Test Page
 *
 * Test page for the FileUpload component.
 * This page allows testing the file upload functionality without
 * the full project creation form.
 */

'use client';

import * as React from 'react';
import { FileUpload } from '@/components/projects/FileUpload';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function UploadTestPage() {
  const [uploadedUrls, setUploadedUrls] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);

  const handleUploadComplete = (publicUrl: string, key: string) => {
    console.log('[Upload Test] Upload completed:', { publicUrl, key });
    setUploadedUrls((prev) => [...prev, publicUrl]);
  };

  const handleUploadError = (error: Error) => {
    console.error('[Upload Test] Upload error:', error);
    setErrors((prev) => [...prev, error.message]);
  };

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">File Upload Test</h1>
          <p className="mt-2 text-muted-foreground">
            Test the FileUpload component with Cloudflare R2 integration
          </p>
        </div>

        {/* Upload Component */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Images</CardTitle>
            <CardDescription>
              Upload images to test the R2 file storage integration. Maximum 10MB per
              file. Supports JPEG, PNG, WebP, and GIF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              maxSizeMB={10}
              acceptedTypes={['image/jpeg', 'image/png', 'image/webp', 'image/gif']}
              fileType="image"
              label="Upload Screenshots"
              multiple={true}
            />
          </CardContent>
        </Card>

        {/* Uploaded URLs */}
        {uploadedUrls.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Uploaded Files ({uploadedUrls.length})</CardTitle>
              <CardDescription>Successfully uploaded files - public URLs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {uploadedUrls.map((url, index) => (
                  <div key={index} className="rounded-lg bg-muted p-3">
                    <p className="break-all font-mono text-sm">{url}</p>
                    <div className="mt-2">
                      <img
                        src={url}
                        alt={`Uploaded ${index + 1}`}
                        className="max-w-xs rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Errors ({errors.length})</CardTitle>
              <CardDescription>Upload errors encountered</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <div key={index} className="rounded-lg bg-destructive/10 p-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="mb-1 font-medium">1. Check R2 Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Ensure your .env.local has R2_ENDPOINT, R2_ACCESS_KEY_ID,
                R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL configured.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium">2. Test Authentication</h3>
              <p className="text-sm text-muted-foreground">
                Make sure you're logged in. The /api/upload endpoint requires
                authentication.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium">3. Upload Files</h3>
              <p className="text-sm text-muted-foreground">
                Try uploading images via drag-and-drop or click to browse. Watch the
                browser console for detailed logging.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium">4. Verify Results</h3>
              <p className="text-sm text-muted-foreground">
                Check that uploaded images display correctly and public URLs are
                accessible.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
