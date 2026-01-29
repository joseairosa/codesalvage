/**
 * Current User API Route
 *
 * Returns the authenticated user's database profile.
 * Used by the AuthProvider to fetch user data after Firebase authentication.
 *
 * GET /api/auth/me
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/firebase-auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const auth = await verifyFirebaseToken(sessionToken);

    return NextResponse.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        username: auth.user.username,
        isSeller: auth.user.isSeller,
        isVerifiedSeller: auth.user.isVerifiedSeller,
        isAdmin: auth.user.isAdmin,
        isBanned: auth.user.isBanned,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
