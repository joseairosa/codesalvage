/**
 * User Avatar API Route
 *
 * PATCH /api/user/avatar — Update the authenticated user's avatar URL
 *
 * Called after the client has uploaded the image to R2 via presigned URL.
 * Saves the R2 public URL to the user's avatarUrl field.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const componentName = 'UserAvatarAPI';

const avatarUpdateSchema = z.object({
  avatarUrl: z.string().url('Must be a valid URL'),
});

/**
 * PATCH /api/user/avatar
 *
 * Save the R2 public URL as the user's avatar
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = avatarUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { avatarUrl } = parsed.data;

    console.log(`[${componentName}] Updating avatar for user:`, auth.user.id);

    await prisma.user.update({
      where: { id: auth.user.id },
      data: { avatarUrl },
    });

    console.log(`[${componentName}] Avatar updated for user:`, auth.user.id);

    return NextResponse.json({ avatarUrl }, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error updating avatar:`, error);
    return NextResponse.json({ error: 'Failed to update avatar' }, { status: 500 });
  }
}
