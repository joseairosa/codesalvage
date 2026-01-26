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
  PaginationOptions as MessagePaginationOptions,
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
