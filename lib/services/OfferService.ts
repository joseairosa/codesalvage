/**
 * OfferService
 *
 * Business logic layer for the offer/negotiation system.
 * Handles validation, permissions, and orchestrates offer workflows.
 *
 * Responsibilities:
 * - Create offers with business rule validation
 * - Counter-offer flow (seller proposes new price back to buyer)
 * - Accept, reject, withdraw offers
 * - Expire stale offers (cron-callable)
 * - Access-controlled offer retrieval
 *
 * Architecture:
 * - Depends on OfferRepository, NotificationService, EmailService
 * - Validates business rules before database operations
 * - Throws typed errors for HTTP status mapping
 * - Async notifications (fire-and-forget)
 */

import type {
  OfferRepository,
  OfferWithRelations,
  OfferQueryOptions,
} from '../repositories/OfferRepository';
import type { ProjectRepository } from '../repositories/ProjectRepository';
import type { NotificationService } from './NotificationService';
import type { EmailService } from './EmailService';
import { MINIMUM_OFFER_CENTS, OFFER_EXPIRY_DAYS } from '../validations/offer';

// ---------- Error classes ----------

export class OfferValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'OfferValidationError';
  }
}

export class OfferPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfferPermissionError';
  }
}

export class OfferNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfferNotFoundError';
  }
}

// ---------- Request types ----------

export interface CreateOfferRequest {
  projectId: string;
  offeredPriceCents: number;
  message?: string;
}

export interface CounterOfferRequest {
  counterPriceCents: number;
  message?: string;
}

export interface RejectOfferRequest {
  reason?: string;
}

// ---------- Service ----------

export class OfferService {
  constructor(
    private offerRepository: OfferRepository,
    private projectRepository: ProjectRepository,
    private notificationService: NotificationService,
    private emailService: EmailService
  ) {
    console.log('[OfferService] Initialized');
  }

  /**
   * Create a new offer from buyer to seller
   *
   * Validates:
   * - Project exists and is active
   * - Buyer is not the seller (no self-offers)
   * - Offered price >= project.minimumOfferCents (if set)
   * - Offered price >= MINIMUM_OFFER_CENTS ($10 hard floor)
   * - Offered price < project.priceCents (must be less than listing)
   * - No existing pending/countered offer from this buyer on this project
   */
  async createOffer(
    buyerId: string,
    data: CreateOfferRequest
  ): Promise<OfferWithRelations> {
    console.log('[OfferService] Creating offer:', {
      buyerId,
      projectId: data.projectId,
      offeredPriceCents: data.offeredPriceCents,
    });

    // Validate project exists and is active
    const project = await this.projectRepository.findById(data.projectId);
    if (!project) {
      throw new OfferValidationError('Project not found', 'projectId');
    }
    if (project.status !== 'active') {
      throw new OfferValidationError(
        'Project is not available for offers',
        'projectId'
      );
    }

    // Prevent self-offers
    if (project.sellerId === buyerId) {
      throw new OfferPermissionError('Cannot make an offer on your own project');
    }

    // Validate price floor
    if (data.offeredPriceCents < MINIMUM_OFFER_CENTS) {
      throw new OfferValidationError(
        `Offer must be at least $${MINIMUM_OFFER_CENTS / 100}`,
        'offeredPriceCents'
      );
    }

    // Validate against project minimum offer (if set)
    if (
      project.minimumOfferCents !== null &&
      project.minimumOfferCents !== undefined &&
      data.offeredPriceCents < project.minimumOfferCents
    ) {
      throw new OfferValidationError(
        `Offer must be at least $${(project.minimumOfferCents / 100).toFixed(2)}`,
        'offeredPriceCents'
      );
    }

    // Offer must be less than listing price
    if (data.offeredPriceCents >= project.priceCents) {
      throw new OfferValidationError(
        'Offer must be less than the listing price. Use Buy Now instead.',
        'offeredPriceCents'
      );
    }

    // Check for existing active offers from this buyer on this project
    const existingOffers = await this.offerRepository.findByBuyerAndProject(
      buyerId,
      data.projectId,
      ['pending', 'countered']
    );
    if (existingOffers.length > 0) {
      throw new OfferValidationError(
        'You already have an active offer on this project',
        'projectId'
      );
    }

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + OFFER_EXPIRY_DAYS);

    // Create the offer
    const createInput: Parameters<typeof this.offerRepository.create>[0] = {
      projectId: data.projectId,
      buyerId,
      sellerId: project.sellerId,
      offeredPriceCents: data.offeredPriceCents,
      originalPriceCents: project.priceCents,
      expiresAt,
    };
    if (data.message !== undefined) {
      createInput.message = data.message;
    }

    const offer = await this.offerRepository.create(createInput);

    console.log('[OfferService] Offer created:', offer.id);

    // Async: Notify seller (fire-and-forget)
    this.notifyNewOffer(offer).catch((err) => {
      console.error('[OfferService] Failed to notify seller:', err);
    });

    return offer;
  }

  /**
   * Create a counter-offer from seller to buyer
   *
   * Validates:
   * - Original offer exists and belongs to this seller
   * - Original offer status is 'pending'
   * - Counter price >= MINIMUM_OFFER_CENTS
   * - Counter price < original listing price
   */
  async counterOffer(
    sellerId: string,
    offerId: string,
    data: CounterOfferRequest
  ): Promise<OfferWithRelations> {
    console.log('[OfferService] Counter-offer:', {
      sellerId,
      offerId,
      counterPriceCents: data.counterPriceCents,
    });

    // Validate original offer
    const originalOffer = await this.offerRepository.findById(offerId);
    if (!originalOffer) {
      throw new OfferNotFoundError('Offer not found');
    }
    if (originalOffer.sellerId !== sellerId) {
      throw new OfferPermissionError('You can only counter-offer on offers sent to you');
    }
    if (originalOffer.status !== 'pending') {
      throw new OfferValidationError(
        'Can only counter a pending offer',
        'status'
      );
    }

    // Validate counter price
    if (data.counterPriceCents < MINIMUM_OFFER_CENTS) {
      throw new OfferValidationError(
        `Counter-offer must be at least $${MINIMUM_OFFER_CENTS / 100}`,
        'counterPriceCents'
      );
    }
    if (data.counterPriceCents >= originalOffer.originalPriceCents) {
      throw new OfferValidationError(
        'Counter-offer must be less than the listing price',
        'counterPriceCents'
      );
    }

    // Mark original offer as countered
    await this.offerRepository.updateStatus(
      offerId,
      'countered',
      new Date()
    );

    // Calculate new expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + OFFER_EXPIRY_DAYS);

    // Create counter-offer as child offer
    const counterInput: Parameters<typeof this.offerRepository.create>[0] = {
      projectId: originalOffer.projectId,
      buyerId: originalOffer.buyerId,
      sellerId: originalOffer.sellerId,
      offeredPriceCents: data.counterPriceCents,
      originalPriceCents: originalOffer.originalPriceCents,
      expiresAt,
      parentOfferId: offerId,
    };
    if (data.message !== undefined) {
      counterInput.message = data.message;
    }

    const counter = await this.offerRepository.create(counterInput);

    console.log('[OfferService] Counter-offer created:', counter.id);

    // Async: Notify buyer (fire-and-forget)
    this.notifyCounterOffer(counter).catch((err) => {
      console.error('[OfferService] Failed to notify buyer of counter:', err);
    });

    return counter;
  }

  /**
   * Accept an offer
   *
   * Can be called by:
   * - Seller accepting a buyer's offer
   * - Buyer accepting a seller's counter-offer
   *
   * Validates:
   * - Offer exists with status 'pending'
   * - User is the intended recipient
   */
  async acceptOffer(
    userId: string,
    offerId: string
  ): Promise<OfferWithRelations> {
    console.log('[OfferService] Accepting offer:', { userId, offerId });

    const offer = await this.offerRepository.findById(offerId);
    if (!offer) {
      throw new OfferNotFoundError('Offer not found');
    }
    if (offer.status !== 'pending') {
      throw new OfferValidationError(
        'Can only accept a pending offer',
        'status'
      );
    }

    // Determine who should accept:
    // - If this is the original offer (no parent), seller accepts
    // - If this is a counter-offer, buyer accepts
    const isCounterOffer = offer.parentOfferId !== null;
    const expectedAcceptor = isCounterOffer ? offer.buyerId : offer.sellerId;

    if (userId !== expectedAcceptor) {
      throw new OfferPermissionError('You cannot accept this offer');
    }

    // Mark as accepted
    const accepted = await this.offerRepository.updateStatus(
      offerId,
      'accepted',
      new Date()
    );

    console.log('[OfferService] Offer accepted:', offerId);

    // Async: Notify the other party
    this.notifyOfferAccepted(accepted).catch((err) => {
      console.error('[OfferService] Failed to notify offer accepted:', err);
    });

    return accepted;
  }

  /**
   * Reject an offer
   *
   * Can be called by:
   * - Seller rejecting a buyer's offer
   * - Buyer rejecting a seller's counter-offer
   */
  async rejectOffer(
    userId: string,
    offerId: string,
    _data?: RejectOfferRequest
  ): Promise<OfferWithRelations> {
    console.log('[OfferService] Rejecting offer:', { userId, offerId });

    const offer = await this.offerRepository.findById(offerId);
    if (!offer) {
      throw new OfferNotFoundError('Offer not found');
    }
    if (offer.status !== 'pending') {
      throw new OfferValidationError(
        'Can only reject a pending offer',
        'status'
      );
    }

    // Determine who should reject (same logic as accept)
    const isCounterOffer = offer.parentOfferId !== null;
    const expectedRejecter = isCounterOffer ? offer.buyerId : offer.sellerId;

    if (userId !== expectedRejecter) {
      throw new OfferPermissionError('You cannot reject this offer');
    }

    const rejected = await this.offerRepository.updateStatus(
      offerId,
      'rejected',
      new Date()
    );

    console.log('[OfferService] Offer rejected:', offerId);

    // Async: Notify the other party
    this.notifyOfferRejected(rejected).catch((err) => {
      console.error('[OfferService] Failed to notify offer rejected:', err);
    });

    return rejected;
  }

  /**
   * Withdraw an offer (buyer cancels their own offer)
   */
  async withdrawOffer(
    userId: string,
    offerId: string
  ): Promise<OfferWithRelations> {
    console.log('[OfferService] Withdrawing offer:', { userId, offerId });

    const offer = await this.offerRepository.findById(offerId);
    if (!offer) {
      throw new OfferNotFoundError('Offer not found');
    }
    if (offer.status !== 'pending') {
      throw new OfferValidationError(
        'Can only withdraw a pending offer',
        'status'
      );
    }

    // Only the original offerer can withdraw
    // For initial offers: buyer created it
    // For counter-offers: seller created it
    const isCounterOffer = offer.parentOfferId !== null;
    const expectedWithdrawer = isCounterOffer ? offer.sellerId : offer.buyerId;

    if (userId !== expectedWithdrawer) {
      throw new OfferPermissionError('You can only withdraw your own offer');
    }

    const withdrawn = await this.offerRepository.updateStatus(
      offerId,
      'withdrawn',
      new Date()
    );

    console.log('[OfferService] Offer withdrawn:', offerId);

    return withdrawn;
  }

  /**
   * Get a single offer by ID (access-controlled)
   */
  async getOfferById(
    offerId: string,
    userId: string
  ): Promise<OfferWithRelations> {
    console.log('[OfferService] Getting offer:', { offerId, userId });

    const offer = await this.offerRepository.findById(offerId);
    if (!offer) {
      throw new OfferNotFoundError('Offer not found');
    }

    // Only buyer or seller can view the offer
    if (offer.buyerId !== userId && offer.sellerId !== userId) {
      throw new OfferPermissionError('You do not have access to this offer');
    }

    return offer;
  }

  /**
   * Get paginated buyer offers
   */
  async getBuyerOffers(
    buyerId: string,
    options?: OfferQueryOptions
  ): Promise<{ offers: OfferWithRelations[]; total: number }> {
    console.log('[OfferService] Getting buyer offers:', buyerId);
    return this.offerRepository.findByBuyerId(buyerId, options);
  }

  /**
   * Get paginated seller offers
   */
  async getSellerOffers(
    sellerId: string,
    options?: OfferQueryOptions
  ): Promise<{ offers: OfferWithRelations[]; total: number }> {
    console.log('[OfferService] Getting seller offers:', sellerId);
    return this.offerRepository.findBySellerId(sellerId, options);
  }

  /**
   * Get all offers on a project (seller only)
   */
  async getProjectOffers(
    projectId: string,
    userId: string,
    options?: OfferQueryOptions
  ): Promise<{ offers: OfferWithRelations[]; total: number }> {
    console.log('[OfferService] Getting project offers:', { projectId, userId });

    // Verify user is the seller of this project
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new OfferValidationError('Project not found', 'projectId');
    }
    if (project.sellerId !== userId) {
      throw new OfferPermissionError('Only the project seller can view all offers');
    }

    return this.offerRepository.findByProjectId(projectId, options);
  }

  /**
   * Expire stale offers (cron-callable)
   *
   * Finds all pending/countered offers past their expiresAt date
   * and marks them as 'expired'. Notifies both parties.
   */
  async expireOffers(): Promise<number> {
    console.log('[OfferService] Expiring stale offers');

    const expiredOffers = await this.offerRepository.findExpiredOffers();

    let expiredCount = 0;
    for (const offer of expiredOffers) {
      try {
        await this.offerRepository.updateStatus(offer.id, 'expired');
        expiredCount++;

        // Async: Notify both parties
        this.notifyOfferExpired(offer).catch((err) => {
          console.error('[OfferService] Failed to notify offer expired:', err);
        });
      } catch (err) {
        console.error('[OfferService] Failed to expire offer:', offer.id, err);
      }
    }

    console.log('[OfferService] Expired', expiredCount, 'offers');
    return expiredCount;
  }

  // ---------- Private notification helpers ----------

  private async notifyNewOffer(offer: OfferWithRelations): Promise<void> {
    const buyerName =
      offer.buyer.fullName || offer.buyer.username || 'A buyer';
    const sellerName =
      offer.seller.fullName || offer.seller.username || 'Seller';
    const projectTitle = offer.project.title;
    const offeredPrice = `$${(offer.offeredPriceCents / 100).toFixed(2)}`;

    // In-app notification
    await this.notificationService.createNotification({
      userId: offer.sellerId,
      type: 'new_offer',
      title: 'New offer received!',
      message: `${buyerName} offered ${offeredPrice} for "${projectTitle}"`,
      actionUrl: `/seller/offers`,
      relatedEntityType: 'offer',
      relatedEntityId: offer.id,
    });

    // Email notification (fire-and-forget)
    if (offer.seller.email) {
      this.emailService
        .sendNewOfferNotification(
          { email: offer.seller.email, name: sellerName },
          {
            recipientName: sellerName,
            otherPartyName: buyerName,
            projectTitle,
            projectId: offer.projectId,
            offeredPriceCents: offer.offeredPriceCents,
            listingPriceCents: offer.originalPriceCents,
            offerUrl: `/seller/offers`,
          }
        )
        .catch((err) => {
          console.error('[OfferService] Failed to send new offer email:', err);
        });
    }
  }

  private async notifyCounterOffer(offer: OfferWithRelations): Promise<void> {
    const sellerName =
      offer.seller.fullName || offer.seller.username || 'The seller';
    const buyerName =
      offer.buyer.fullName || offer.buyer.username || 'Buyer';
    const projectTitle = offer.project.title;
    const counterPrice = `$${(offer.offeredPriceCents / 100).toFixed(2)}`;

    // In-app notification
    await this.notificationService.createNotification({
      userId: offer.buyerId,
      type: 'offer_countered',
      title: 'Counter-offer received!',
      message: `${sellerName} counter-offered ${counterPrice} for "${projectTitle}"`,
      actionUrl: `/dashboard/offers`,
      relatedEntityType: 'offer',
      relatedEntityId: offer.id,
    });

    // Email notification (fire-and-forget)
    if (offer.buyer.email) {
      this.emailService
        .sendOfferCounteredNotification(
          { email: offer.buyer.email, name: buyerName },
          {
            recipientName: buyerName,
            otherPartyName: sellerName,
            projectTitle,
            projectId: offer.projectId,
            offeredPriceCents: offer.offeredPriceCents,
            listingPriceCents: offer.originalPriceCents,
            offerUrl: `/dashboard/offers`,
          }
        )
        .catch((err) => {
          console.error('[OfferService] Failed to send counter-offer email:', err);
        });
    }
  }

  private async notifyOfferAccepted(offer: OfferWithRelations): Promise<void> {
    const isCounterOffer = offer.parentOfferId !== null;
    // Notify the party who didn't accept
    const recipientId = isCounterOffer ? offer.sellerId : offer.buyerId;
    const otherPartyName = isCounterOffer
      ? offer.buyer.fullName || offer.buyer.username || 'The buyer'
      : offer.seller.fullName || offer.seller.username || 'The seller';
    const recipientName = isCounterOffer
      ? offer.seller.fullName || offer.seller.username || 'Seller'
      : offer.buyer.fullName || offer.buyer.username || 'Buyer';
    const recipientEmail = isCounterOffer ? offer.seller.email : offer.buyer.email;
    const projectTitle = offer.project.title;
    const agreedPrice = `$${(offer.offeredPriceCents / 100).toFixed(2)}`;
    const actionUrl = isCounterOffer ? `/seller/offers` : `/dashboard/offers`;

    // In-app notification
    await this.notificationService.createNotification({
      userId: recipientId,
      type: 'offer_accepted',
      title: 'Offer accepted!',
      message: `${otherPartyName} accepted the offer of ${agreedPrice} for "${projectTitle}"`,
      actionUrl,
      relatedEntityType: 'offer',
      relatedEntityId: offer.id,
    });

    // Email notification (fire-and-forget)
    if (recipientEmail) {
      // Buyer gets checkout URL, seller doesn't
      const emailData: Parameters<typeof this.emailService.sendOfferAcceptedNotification>[1] = {
        recipientName,
        otherPartyName,
        projectTitle,
        projectId: offer.projectId,
        offeredPriceCents: offer.offeredPriceCents,
        listingPriceCents: offer.originalPriceCents,
        offerUrl: actionUrl,
      };
      if (!isCounterOffer) {
        // Buyer accepted seller's counter — no checkout needed (seller accepted buyer's offer gives buyer checkout)
        // Actually: if !isCounterOffer, seller accepted buyer's initial offer → notify buyer with checkout URL
        emailData.checkoutUrl = `/checkout/${offer.projectId}?offerId=${offer.id}`;
      }

      this.emailService
        .sendOfferAcceptedNotification(
          { email: recipientEmail, name: recipientName },
          emailData
        )
        .catch((err) => {
          console.error('[OfferService] Failed to send offer accepted email:', err);
        });
    }
  }

  private async notifyOfferRejected(offer: OfferWithRelations): Promise<void> {
    const isCounterOffer = offer.parentOfferId !== null;
    const recipientId = isCounterOffer ? offer.sellerId : offer.buyerId;
    const otherPartyName = isCounterOffer
      ? offer.buyer.fullName || offer.buyer.username || 'The buyer'
      : offer.seller.fullName || offer.seller.username || 'The seller';
    const recipientName = isCounterOffer
      ? offer.seller.fullName || offer.seller.username || 'Seller'
      : offer.buyer.fullName || offer.buyer.username || 'Buyer';
    const recipientEmail = isCounterOffer ? offer.seller.email : offer.buyer.email;
    const projectTitle = offer.project.title;
    const actionUrl = isCounterOffer ? `/seller/offers` : `/dashboard/offers`;

    // In-app notification
    await this.notificationService.createNotification({
      userId: recipientId,
      type: 'offer_rejected',
      title: 'Offer rejected',
      message: `${otherPartyName} rejected your offer for "${projectTitle}"`,
      actionUrl,
      relatedEntityType: 'offer',
      relatedEntityId: offer.id,
    });

    // Email notification (fire-and-forget)
    if (recipientEmail) {
      this.emailService
        .sendOfferRejectedNotification(
          { email: recipientEmail, name: recipientName },
          {
            recipientName,
            otherPartyName,
            projectTitle,
            projectId: offer.projectId,
            offeredPriceCents: offer.offeredPriceCents,
            listingPriceCents: offer.originalPriceCents,
            offerUrl: actionUrl,
          }
        )
        .catch((err) => {
          console.error('[OfferService] Failed to send offer rejected email:', err);
        });
    }
  }

  private async notifyOfferExpired(offer: OfferWithRelations): Promise<void> {
    const projectTitle = offer.project.title;

    // Notify both buyer and seller (in-app)
    await Promise.all([
      this.notificationService.createNotification({
        userId: offer.buyerId,
        type: 'offer_expired',
        title: 'Offer expired',
        message: `Your offer for "${projectTitle}" has expired`,
        actionUrl: `/dashboard/offers`,
        relatedEntityType: 'offer',
        relatedEntityId: offer.id,
      }),
      this.notificationService.createNotification({
        userId: offer.sellerId,
        type: 'offer_expired',
        title: 'Offer expired',
        message: `An offer for "${projectTitle}" has expired`,
        actionUrl: `/seller/offers`,
        relatedEntityType: 'offer',
        relatedEntityId: offer.id,
      }),
    ]);
  }
}
