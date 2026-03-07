/**
 * Admin API Route: Resolve Dispute
 *
 * PATCH /api/admin/disputes/[id]/resolve
 *
 * Body:
 * - status: 'resolved_refund' | 'resolved_no_refund' | 'resolved_partial'
 * - resolution: string (admin notes, min 10 chars)
 * - action: 'release_escrow' | 'issue_refund' | 'none'
 *
 * Responses:
 * - 200: Dispute resolved
 * - 400: Validation error
 * - 401: Unauthorized (not admin)
 * - 404: Dispute not found
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getDisputeRepository, getAdminService } from '@/lib/utils/admin-services';
import { emailService } from '@/lib/services/EmailService';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const resolveSchema = z.object({
  status: z.enum(['resolved_refund', 'resolved_no_refund', 'resolved_partial']),
  resolution: z.string().min(10, 'Resolution notes must be at least 10 characters'),
  action: z.enum(['release_escrow', 'issue_refund', 'none']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: disputeId } = await params;
    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { status, resolution, action } = parsed.data;

    const disputeRepository = getDisputeRepository();

    // Fetch the dispute with its transaction
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        transaction: {
          include: {
            buyer: { select: { id: true, email: true, fullName: true, username: true } },
            seller: { select: { id: true, email: true, fullName: true, username: true } },
            project: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    const adminService = getAdminService();
    const ip = request.headers.get('x-forwarded-for') ?? undefined;
    const auditReason = `Dispute ${disputeId} resolved: ${resolution}`;

    // Execute the escrow/refund action first
    if (action === 'release_escrow') {
      await adminService.releaseEscrowManually(
        auth.user.id,
        dispute.transactionId,
        auditReason,
        ip
      );
    } else if (action === 'issue_refund') {
      await adminService.refundTransaction(
        auth.user.id,
        dispute.transactionId,
        auditReason,
        ip
      );
    }

    // Update dispute status
    const updated = await disputeRepository.updateStatus(
      disputeId,
      status,
      resolution,
      auth.user.id
    );

    // Non-blocking resolution emails to both parties
    const projectTitle = dispute.transaction.project?.title ?? 'your project';
    const emailData = {
      projectTitle,
      resolution: status,
      resolutionNote: resolution,
      transactionId: dispute.transactionId,
      disputeId,
    };

    const buyerEmail = dispute.transaction.buyer?.email;
    const buyerName =
      dispute.transaction.buyer?.fullName ??
      dispute.transaction.buyer?.username ??
      'Buyer';

    const sellerEmail = dispute.transaction.seller?.email;
    const sellerName =
      dispute.transaction.seller?.fullName ??
      dispute.transaction.seller?.username ??
      'Seller';

    if (buyerEmail) {
      emailService
        .sendDisputeResolvedNotification(
          { email: buyerEmail, name: buyerName },
          {
            ...emailData,
            recipientName: buyerName,
          }
        )
        .catch((e) => console.error('[Admin Disputes] Buyer email failed:', e));
    }

    if (sellerEmail) {
      emailService
        .sendDisputeResolvedNotification(
          { email: sellerEmail, name: sellerName },
          {
            ...emailData,
            recipientName: sellerName,
          }
        )
        .catch((e) => console.error('[Admin Disputes] Seller email failed:', e));
    }

    return NextResponse.json({ dispute: updated }, { status: 200 });
  } catch (error) {
    console.error('[Admin API] Resolve dispute error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to resolve dispute', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Failed to resolve dispute' }, { status: 500 });
  }
}
