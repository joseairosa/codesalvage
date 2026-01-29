/**
 * API Key Revocation Route
 *
 * Responsibilities:
 * - Revoke an API key (POST)
 *
 * Architecture:
 * - Requires authentication (Firebase token in cookie)
 * - Only owner can revoke their own keys
 * - Revoked keys cannot be reactivated
 * - Follows ataglance pattern for consistency
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/firebase-auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/user/api-keys/[keyId]/revoke
 * Revoke an API key
 *
 * Body: { reason?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    // Get session token from cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      console.log('[API Keys] REVOKE: No session token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify authentication
    const auth = await verifyFirebaseToken(sessionToken);

    // Get keyId from params
    const { keyId } = await params;

    console.log('[API Keys] REVOKE: Revoking API key:', keyId, 'for user:', auth.user.id);

    // Parse optional reason
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // Body is optional, ignore parse errors
    }

    // Find the API key and verify ownership
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      select: { id: true, userId: true, status: true },
    });

    if (!apiKey) {
      console.log('[API Keys] REVOKE: API key not found:', keyId);
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Verify ownership
    if (apiKey.userId !== auth.user.id) {
      console.log('[API Keys] REVOKE: User does not own this key');
      return NextResponse.json(
        { error: 'You do not have permission to revoke this key' },
        { status: 403 }
      );
    }

    // Check if already revoked
    if (apiKey.status === 'revoked') {
      console.log('[API Keys] REVOKE: Key already revoked:', keyId);
      return NextResponse.json(
        { error: 'API key is already revoked' },
        { status: 400 }
      );
    }

    // Revoke the key - filter out undefined to satisfy exactOptionalPropertyTypes
    const updateData: {
      status: string;
      revokedAt: Date;
      revokedReason?: string;
    } = {
      status: 'revoked',
      revokedAt: new Date(),
    };

    if (reason !== undefined) {
      updateData.revokedReason = reason;
    }

    const revokedKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: updateData,
      select: {
        id: true,
        name: true,
        prefix: true,
        status: true,
        revokedAt: true,
        revokedReason: true,
      },
    });

    console.log('[API Keys] REVOKE: API key revoked successfully:', keyId);

    return NextResponse.json({
      message: 'API key revoked successfully',
      apiKey: revokedKey,
    });
  } catch (error) {
    console.error('[API Keys] REVOKE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
