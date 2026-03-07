/**
 * Dispute API Route
 *
 * POST /api/transactions/[id]/dispute — Buyer opens a dispute
 * GET  /api/transactions/[id]/dispute — Get dispute status (buyer or seller)
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { DisputeRepository } from '@/lib/repositories/DisputeRepository';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { DisputeService, DisputeValidationError, DisputePermissionError } from '@/lib/services/DisputeService';
import { z } from 'zod';

const disputeRepository = new DisputeRepository(prisma);
const transactionRepository = new TransactionRepository(prisma);
const disputeService = new DisputeService(disputeRepository, transactionRepository);

const openDisputeSchema = z.object({
  reason: z.string().min(1),
  description: z.string().min(20, 'Description must be at least 20 characters'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await params;
    const body = await request.json();
    const parsed = openDisputeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const dispute = await disputeService.openDispute(
      auth.user.id,
      transactionId,
      parsed.data.reason,
      parsed.data.description
    );

    return NextResponse.json(dispute, { status: 201 });
  } catch (error) {
    if (error instanceof DisputePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DisputeValidationError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 400 }
      );
    }
    console.error('[Dispute API] POST error:', error);
    return NextResponse.json({ error: 'Failed to open dispute' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await params;

    const dispute = await disputeService.getDisputeForTransaction(
      auth.user.id,
      transactionId
    );

    return NextResponse.json({ dispute }, { status: 200 });
  } catch (error) {
    if (error instanceof DisputePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('[Dispute API] GET error:', error);
    return NextResponse.json({ error: 'Failed to get dispute' }, { status: 500 });
  }
}
