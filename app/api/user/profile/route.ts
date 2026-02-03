/**
 * User Profile API Route
 *
 * PATCH /api/user/profile — Update the authenticated user's profile
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { updateProfileSchema } from '@/lib/validations/user';

const componentName = 'UserProfileAPI';

const userRepository = new UserRepository(prisma);

/**
 * PATCH /api/user/profile
 *
 * Update authenticated user's profile (fullName, username, bio)
 */
async function updateProfile(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { username, fullName, bio } = parsed.data;

    // Check username uniqueness (case-insensitive) if it changed
    const currentUser = await userRepository.findById(auth.user.id);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (username.toLowerCase() !== currentUser.username?.toLowerCase()) {
      const existing = await userRepository.findByUsername(username);
      if (existing) {
        return NextResponse.json(
          { error: 'Username already taken', field: 'username' },
          { status: 409 }
        );
      }
    }

    console.log(`[${componentName}] Updating profile for user:`, auth.user.id);

    const updated = await userRepository.updateUserProfile(auth.user.id, {
      fullName: fullName || null,
      bio: bio || null,
    });

    // Username update needs a separate prisma call since it's not in UserProfileUpdate
    if (username.toLowerCase() !== currentUser.username?.toLowerCase()) {
      await prisma.user.update({
        where: { id: auth.user.id },
        data: { username: username.toLowerCase() },
      });
    }

    console.log(`[${componentName}] Profile updated for user:`, auth.user.id);

    return NextResponse.json(
      {
        user: {
          id: updated.id,
          fullName: updated.fullName,
          username: username.toLowerCase(),
          bio: updated.bio,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error updating profile:`, error);

    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export const PATCH = withApiRateLimit(updateProfile, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
