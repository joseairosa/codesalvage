/**
 * FeedbackService
 *
 * Business logic for user feedback submissions and admin management.
 *
 * Responsibilities:
 * - Validate and submit user feedback
 * - Rate limiting (5 submissions per user per day)
 * - Admin operations: list, update status/priority/notes, delete
 */

import type {
  FeedbackRepository,
  CreateFeedbackInput,
  FeedbackFilters,
  FeedbackStatus,
  FeedbackPriority,
} from '@/lib/repositories/FeedbackRepository';

const MAX_SUBMISSIONS_PER_DAY = 5;

export class FeedbackValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'FeedbackValidationError';
  }
}

export class FeedbackNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedbackNotFoundError';
  }
}

export class FeedbackService {
  constructor(private feedbackRepo: FeedbackRepository) {}

  /**
   * Check remaining submissions for a user today
   */
  async checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const count = await this.feedbackRepo.countByUserToday(userId);
    const remaining = Math.max(0, MAX_SUBMISSIONS_PER_DAY - count);
    return { allowed: remaining > 0, remaining };
  }

  /**
   * Submit feedback (authenticated or anonymous)
   */
  async submit(
    input: {
      type: CreateFeedbackInput['type'];
      title: string;
      content: string;
      email: string;
      userAgent?: string;
    },
    userId?: string
  ) {
    if (!input.title || !input.title.trim()) {
      throw new FeedbackValidationError('Title is required', 'title');
    }
    if (input.title.length > 200) {
      throw new FeedbackValidationError('Title must be 200 characters or less', 'title');
    }
    if (!input.content || !input.content.trim()) {
      throw new FeedbackValidationError('Content is required', 'content');
    }
    if (input.content.length > 5000) {
      throw new FeedbackValidationError(
        'Content must be 5000 characters or less',
        'content'
      );
    }
    if (!input.email || !input.email.trim()) {
      throw new FeedbackValidationError('Email is required', 'email');
    }

    // Rate limit check for authenticated users
    if (userId) {
      const { allowed } = await this.checkRateLimit(userId);
      if (!allowed) {
        throw new FeedbackValidationError(
          'Daily feedback limit reached. Please try again tomorrow.'
        );
      }
    }

    return this.feedbackRepo.create({
      type: input.type,
      title: input.title.trim(),
      content: input.content.trim(),
      email: input.email.trim(),
      ...(userId !== undefined && { userId }),
      ...(input.userAgent !== undefined && { userAgent: input.userAgent }),
    });
  }

  /**
   * List feedback with filters (admin only)
   */
  async list(filters: FeedbackFilters) {
    return this.feedbackRepo.findMany(filters);
  }

  /**
   * Get feedback stats (admin only)
   */
  async getStats() {
    return this.feedbackRepo.getStats();
  }

  /**
   * Update feedback status (admin only)
   */
  async updateStatus(id: string, status: FeedbackStatus, adminUserId: string) {
    const entry = await this.feedbackRepo.findById(id);
    if (!entry) throw new FeedbackNotFoundError(`Feedback ${id} not found`);

    const resolvedAt = status === 'resolved' ? new Date() : null;
    const resolvedBy = status === 'resolved' ? adminUserId : null;

    return this.feedbackRepo.update(id, { status, resolvedAt, resolvedBy });
  }

  /**
   * Update feedback priority (admin only)
   */
  async updatePriority(id: string, priority: FeedbackPriority) {
    const entry = await this.feedbackRepo.findById(id);
    if (!entry) throw new FeedbackNotFoundError(`Feedback ${id} not found`);

    return this.feedbackRepo.update(id, { priority });
  }

  /**
   * Update admin notes (admin only)
   */
  async updateNotes(id: string, adminNotes: string) {
    const entry = await this.feedbackRepo.findById(id);
    if (!entry) throw new FeedbackNotFoundError(`Feedback ${id} not found`);

    return this.feedbackRepo.update(id, { adminNotes });
  }

  /**
   * Delete a feedback entry (admin only)
   */
  async delete(id: string) {
    const entry = await this.feedbackRepo.findById(id);
    if (!entry) throw new FeedbackNotFoundError(`Feedback ${id} not found`);

    return this.feedbackRepo.delete(id);
  }
}
