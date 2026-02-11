/**
 * Offers API — List & Create
 *
 * POST /api/offers — Create a new offer
 * GET  /api/offers — List offers (buyer or seller view)
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
  OfferValidationError,
  OfferPermissionError,
} from '@/lib/services/OfferService';
import { createOfferSchema } from '@/lib/validations/offer';

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
 * POST /api/offers — Create a new offer
 */
async function createOffer(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = createOfferSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.errors },
        { status: 400 }
      );
    }

    const createData: { projectId: string; offeredPriceCents: number; message?: string } = {
      projectId: validated.data.projectId,
      offeredPriceCents: validated.data.offeredPriceCents,
    };
    if (validated.data.message !== undefined && validated.data.message !== '') {
      createData.message = validated.data.message;
    }

    const offer = await offerService.createOffer(auth.user.id, createData);

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    console.error('[OffersAPI] Error creating offer:', error);

    if (error instanceof OfferValidationError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 400 }
      );
    }
    if (error instanceof OfferPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: 'Failed to create offer',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/offers — List offers
 *
 * Query params:
 *   view=buyer|seller  (required)
 *   status=pending|accepted|...  (optional filter)
 *   page=1  (optional, default 1)
 *   limit=20  (optional, default 20)
 */
async function listOffers(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');
    const statusParam = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!view || !['buyer', 'seller'].includes(view)) {
      return NextResponse.json(
        { error: 'Query parameter "view" must be "buyer" or "seller"' },
        { status: 400 }
      );
    }

    const options: { page: number; limit: number; status?: string } = { page, limit };
    if (statusParam) {
      options.status = statusParam;
    }

    const result =
      view === 'buyer'
        ? await offerService.getBuyerOffers(auth.user.id, options)
        : await offerService.getSellerOffers(auth.user.id, options);

    return NextResponse.json({
      offers: result.offers,
      pagination: {
        total: result.total,
        page,
        limit,
        hasMore: page * limit < result.total,
      },
    });
  } catch (error) {
    console.error('[OffersAPI] Error listing offers:', error);

    return NextResponse.json(
      {
        error: 'Failed to list offers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const POST = createOffer;
export const GET = listOffers;
