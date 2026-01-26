/**
 * Services Barrel Export
 *
 * Centralized export for all service classes.
 * Makes imports cleaner: import { AuthService } from '@/lib/services'
 */

export { AuthService } from './AuthService';
export type { GitHubProfile, AuthUserData } from './AuthService';

export {
  ProjectService,
  ProjectValidationError,
  ProjectPermissionError,
} from './ProjectService';
export type { CreateProjectRequest } from './ProjectService';
export {
  PROJECT_CATEGORIES,
  LICENSE_TYPES,
  ACCESS_LEVELS,
  PROJECT_STATUSES,
} from './ProjectService';

export { R2Service, r2Service, FileType } from './R2Service';
export type { UploadConfig, UploadUrlResponse } from './R2Service';

export { StripeService, stripeService } from './StripeService';
export type { StripeUserData } from './StripeService';

export { EmailService, emailService } from './EmailService';
export type {
  EmailRecipient,
  PurchaseEmailData,
  EscrowReleaseEmailData,
  MessageEmailData,
  ReviewEmailData,
  FeaturedListingEmailData,
} from './EmailService';

export {
  MessageService,
  MessageValidationError,
  MessagePermissionError,
} from './MessageService';
export type { SendMessageRequest } from './MessageService';
export { MAX_MESSAGE_LENGTH } from './MessageService';

export {
  ReviewService,
  ReviewValidationError,
  ReviewPermissionError,
  ReviewNotFoundError,
} from './ReviewService';
export type { CreateReviewRequest } from './ReviewService';
export { MIN_RATING, MAX_RATING, MAX_COMMENT_LENGTH } from './ReviewService';

export {
  FavoriteService,
  FavoriteValidationError,
  FavoritePermissionError,
} from './FavoriteService';
export type { ToggleFavoriteResult } from './FavoriteService';

export {
  TransactionService,
  TransactionValidationError,
  TransactionPermissionError,
  TransactionNotFoundError,
} from './TransactionService';
export type { CreateTransactionRequest } from './TransactionService';

export {
  AnalyticsService,
  AnalyticsPermissionError,
  AnalyticsValidationError,
} from './AnalyticsService';
export type {
  AnalyticsOverviewRequest,
  AnalyticsOverviewResponse,
} from './AnalyticsService';

export {
  FeaturedListingService,
  FeaturedListingValidationError,
  FeaturedListingPermissionError,
  FeaturedListingNotFoundError,
} from './FeaturedListingService';
export type {
  PurchaseFeaturedRequest,
  PurchaseFeaturedResponse,
} from './FeaturedListingService';

export {
  SubscriptionService,
  SubscriptionValidationError,
  SubscriptionPermissionError,
  SubscriptionNotFoundError,
} from './SubscriptionService';
export type {
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  SubscriptionStatusResponse,
} from './SubscriptionService';
