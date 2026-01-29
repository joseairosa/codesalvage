/**
 * Upload API Route
 *
 * Generates pre-signed URLs for uploading files to Cloudflare R2.
 *
 * POST /api/upload
 * - Generates upload URL for client-side file uploads
 * - Requires authentication
 * - Validates file type and size
 *
 * @example
 * POST /api/upload
 * {
 *   "filename": "screenshot.png",
 *   "mimeType": "image/png",
 *   "fileType": "image"
 * }
 *
 * Response:
 * {
 *   "uploadUrl": "https://...",
 *   "key": "image/user123/123456-screenshot.png",
 *   "publicUrl": "https://pub-xxx.r2.dev/...",
 *   "expiresAt": 1234567890
 * }
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { r2Service, FileType } from '@/lib/services';
import { z } from 'zod';

/**
 * Request body schema
 */
const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  fileType: z.nativeEnum(FileType),
});

/**
 * POST /api/upload
 *
 * Generate pre-signed upload URL
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = uploadRequestSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    const { filename, mimeType, fileType } = validatedData.data;

    console.log('[Upload API] Generating upload URL:', {
      userId: auth.user.id,
      filename,
      fileType,
    });

    // Generate upload URL
    const uploadResponse = await r2Service.getUploadUrl(
      filename,
      mimeType,
      auth.user.id,
      fileType
    );

    console.log('[Upload API] Upload URL generated successfully');

    return NextResponse.json(uploadResponse, { status: 200 });
  } catch (error) {
    console.error('[Upload API] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to generate upload URL',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
