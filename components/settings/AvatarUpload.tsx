'use client';

/**
 * AvatarUpload Component
 *
 * Handles user profile picture upload with:
 * - Current avatar preview (or initials fallback)
 * - File selection via button click
 * - Client-side validation (type, size)
 * - Two-step upload: presigned URL from /api/upload, then PUT to R2
 * - Saves final URL via PATCH /api/user/avatar
 */

import { useRef, useState } from 'react';
import { Camera, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  userInitials: string;
}

export function AvatarUpload({ currentAvatarUrl, userInitials }: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are allowed.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be smaller than 5MB.');
      return;
    }

    setUploading(true);

    try {
      // Step 1: Get presigned upload URL from our API
      const presignResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          fileType: 'image',
        }),
      });

      if (!presignResponse.ok) {
        const err = await presignResponse.json();
        throw new Error(err.error || 'Failed to get upload URL');
      }

      const { uploadUrl, publicUrl } = await presignResponse.json();

      // Step 2: Upload directly to R2 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      // Step 3: Save the public URL to user profile
      const saveResponse = await fetch('/api/user/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });

      if (!saveResponse.ok) {
        const err = await saveResponse.json();
        throw new Error(err.error || 'Failed to save avatar');
      }

      setAvatarUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar preview */}
      <div className="relative">
        <div className="h-24 w-24 overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Profile avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">
              {userInitials}
            </div>
          )}
        </div>

        {/* Camera overlay button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-800 text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          aria-label="Change profile photo"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Upload button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          'Change photo'
        )}
      </Button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {error && (
        <Alert variant="destructive" className="w-full max-w-xs">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP · Max 5MB</p>
    </div>
  );
}
