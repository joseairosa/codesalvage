/**
 * API Keys Management Route
 *
 * Responsibilities:
 * - Create new API keys (POST)
 * - List user's API keys (GET)
 *
 * Architecture:
 * - Requires authentication (Firebase token in cookie)
 * - API keys use sk-xxx format
 * - Stores SHA-256 hash, never plaintext
 * - Returns full key only once on creation
 * - Follows ataglance pattern for consistency
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/firebase-auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * GET /api/user/api-keys
 * List all API keys for the authenticated user
 */
export async function GET() {
  try {
    // Get session token from cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      console.log('[API Keys] GET: No session token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify authentication
    const auth = await verifyFirebaseToken(sessionToken);

    console.log('[API Keys] GET: Listing API keys for user:', auth.user.id);

    // Fetch all API keys for this user
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: auth.user.id },
      select: {
        id: true,
        name: true,
        prefix: true,
        status: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
        revokedReason: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('[API Keys] GET: Found', apiKeys.length, 'API keys');

    return NextResponse.json({
      apiKeys,
    });
  } catch (error) {
    console.error('[API Keys] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/api-keys
 * Create a new API key
 *
 * Body: { name: string, expiresInDays?: number }
 */
export async function POST(request: Request) {
  try {
    // Get session token from cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      console.log('[API Keys] POST: No session token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify authentication
    const auth = await verifyFirebaseToken(sessionToken);

    // Parse request body
    const body = await request.json();
    const { name, expiresInDays } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      console.log('[API Keys] POST: Invalid name');
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    console.log('[API Keys] POST: Creating API key for user:', auth.user.id, 'name:', name);

    // Generate secure random API key (sk-xxx format, 32 bytes = 64 hex chars)
    const randomBytes = crypto.randomBytes(32);
    const apiKey = `sk-${randomBytes.toString('hex')}`;

    // Create hash for storage (never store plaintext)
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Get prefix for display (first 8 chars after sk-)
    const prefix = apiKey.substring(0, 11); // sk- + first 8 chars

    // Calculate expiration date if provided
    let expiresAt: Date | null = null;
    if (expiresInDays && typeof expiresInDays === 'number' && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Create API key in database
    const createdKey = await prisma.apiKey.create({
      data: {
        userId: auth.user.id,
        name: name.trim(),
        keyHash,
        prefix,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    console.log('[API Keys] POST: API key created successfully:', createdKey.id);

    // Return the full key ONLY ONCE (never stored or returned again)
    return NextResponse.json({
      apiKey: apiKey, // Full key (sk-xxx...)
      keyData: createdKey,
      message: 'Save this key securely. You will not be able to see it again.',
    });
  } catch (error) {
    console.error('[API Keys] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
