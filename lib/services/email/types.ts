/**
 * Email data interfaces shared across all email modules.
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface PurchaseEmailData {
  buyerName: string;
  sellerName: string;
  projectTitle: string;
  projectId: string;
  transactionId: string;
  amount: number;
  downloadUrl: string;
  purchaseDate: string;
}

export interface EscrowReleaseEmailData {
  sellerName: string;
  projectTitle: string;
  amount: number;
  releaseDate: string;
  transactionId: string;
}

export interface MessageEmailData {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  projectTitle?: string;
  conversationUrl: string;
}

export interface ReviewEmailData {
  sellerName: string;
  buyerName: string;
  projectTitle: string;
  rating: number;
  comment?: string;
  reviewUrl: string;
}

export interface FeaturedListingEmailData {
  sellerName: string;
  projectTitle: string;
  projectId: string;
  durationDays: number;
  costCents: number;
  featuredUntil: string;
  projectUrl: string;
}

export interface OfferEmailData {
  recipientName: string;
  otherPartyName: string;
  projectTitle: string;
  projectId: string;
  offeredPriceCents: number;
  listingPriceCents: number;
  offerUrl: string;
  checkoutUrl?: string;
}

export interface UserBannedEmailData {
  username: string;
  reason: string;
  bannedAt: string;
  supportEmail: string;
}

export interface UserUnbannedEmailData {
  username: string;
  unbannedAt: string;
}

export interface RefundEmailData {
  buyerName: string;
  projectTitle: string;
  amountCents: number;
  refundDate: string;
  transactionId: string;
  reason?: string;
}

export interface WelcomeEmailData {
  username: string;
}

export interface PaymentFailedEmailData {
  buyerName: string;
  projectTitle: string;
  amountCents: number;
  transactionId: string;
}

export interface RepoTransferEmailData {
  buyerName: string;
  projectTitle: string;
  projectId: string;
  transactionId: string;
}

export interface StripeConnectConfirmedEmailData {
  sellerName: string;
}
