/**
 * Single Offer API — Get offer by ID
 *
 * GET /api/offers/[id] — Get single offer (access-controlled)
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { OfferRepository } from '@/lib/repositories/OfferRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { NotificationRepository } from '@/lib/repositories/NotificationRepository';
import { NotificationService } from '@/lib/services/NotificationService';
import { emailService } from '@/lib/services/EmailService';
import {
  OfferService,
  OfferNotFoundError,
  OfferPermissionError,
} from '@/lib/services/OfferService';

const offerRepository = new OfferRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const notificationRepository = new NotificationRepository(prisma);
const notificationService = new NotificationService(notificationRepository);
const offerService = new OfferService(
  offerRepository,
  projectRepository,
  notificationService,
  emailService as any
);

/**
 * GET /api/offers/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const offer = await offerService.getOfferById(id, auth.user.id);

    return NextResponse.json(offer);
  } catch (error) {
    console.error('[OfferDetailAPI] Error getting offer:', error);

    if (error instanceof OfferNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof OfferPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: 'Failed to get offer',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
