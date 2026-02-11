/**
 * Counter Offer API
 *
 * POST /api/offers/[id]/counter — Make a counter-offer
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
  OfferNotFoundError,
  OfferPermissionError,
} from '@/lib/services/OfferService';
import { counterOfferSchema } from '@/lib/validations/offer';

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const validated = counterOfferSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.errors },
        { status: 400 }
      );
    }

    const counterData: { counterPriceCents: number; message?: string } = {
      counterPriceCents: validated.data.counterPriceCents,
    };
    if (validated.data.message !== undefined && validated.data.message !== '') {
      counterData.message = validated.data.message;
    }

    const offer = await offerService.counterOffer(
      auth.user.id,
      id,
      counterData
    );

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    console.error('[CounterOfferAPI] Error creating counter-offer:', error);

    if (error instanceof OfferNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
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
        error: 'Failed to create counter-offer',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
