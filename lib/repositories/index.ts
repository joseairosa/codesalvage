/**
 * Repositories Barrel Export
 *
 * Centralized export for all repository classes.
 * Makes imports cleaner: import { UserRepository } from '@/lib/repositories'
 */

export { UserRepository } from './UserRepository';
export type { UserProfileUpdate } from './UserRepository';

export { ProjectRepository } from './ProjectRepository';
export type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectSearchFilters,
  PaginationOptions,
  PaginatedProjects,
} from './ProjectRepository';

export { MessageRepository } from './MessageRepository';
export type {
  CreateMessageInput,
  MessageWithRelations,
  ConversationSummary,
} from './MessageRepository';

export { ReviewRepository } from './ReviewRepository';
export type {
  CreateReviewInput,
  ReviewWithRelations,
  PaginatedReviews,
  SellerRatingStats,
  PaginationOptions as ReviewPaginationOptions,
} from './ReviewRepository';

export { FavoriteRepository } from './FavoriteRepository';
export type {
  FavoriteWithProject,
  PaginatedFavorites,
  PaginationOptions as FavoritePaginationOptions,
} from './FavoriteRepository';

export { TransactionRepository } from './TransactionRepository';
export type {
  CreateTransactionInput,
  TransactionWithRelations,
  PaginatedTransactions,
  PaginationOptions as TransactionPaginationOptions,
} from './TransactionRepository';

export { AnalyticsRepository } from './AnalyticsRepository';
export type {
  SellerRevenueSummary,
  RevenueDataPoint,
  ProjectPerformanceMetrics,
  SellerAnalyticsOverview,
  DateRangeFilter,
} from './AnalyticsRepository';

export { FeaturedListingRepository } from './FeaturedListingRepository';
export type {
  FeaturedProjectWithSeller,
  PaginatedFeaturedProjects,
  FeaturedPaginationOptions,
} from './FeaturedListingRepository';

export { SubscriptionRepository } from './SubscriptionRepository';
export type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  SubscriptionWithUser,
} from './SubscriptionRepository';

export { NotificationRepository } from './NotificationRepository';
export type {
  CreateNotificationInput,
  NotificationType,
  NotificationQueryOptions,
} from './NotificationRepository';

export { AdminRepository } from './AdminRepository';
export type {
  PlatformStats,
  CreateAuditLogInput,
  CreateContentReportInput,
  UpdateContentReportInput,
  AuditLogWithAdmin,
  ContentReportWithReporter,
  AdminPaginationOptions,
} from './AdminRepository';

export { OfferRepository } from './OfferRepository';
export type {
  CreateOfferInput,
  OfferWithRelations,
  OfferQueryOptions,
} from './OfferRepository';

export { RepositoryTransferRepository } from './RepositoryTransferRepository';
export type { CreateRepositoryTransferInput } from './RepositoryTransferRepository';
