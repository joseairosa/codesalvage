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
