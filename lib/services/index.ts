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
} from './EmailService';
