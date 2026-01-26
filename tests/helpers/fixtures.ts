/**
 * Test Data Fixtures
 *
 * Factory functions for creating test data.
 * Uses faker for realistic test data generation.
 *
 * Usage:
 * ```typescript
 * import { createTestUser, createTestProject } from '@/tests/helpers/fixtures';
 *
 * const user = await createTestUser({ email: 'custom@example.com' });
 * const project = await createTestProject({ sellerId: user.id });
 * ```
 */

import { faker } from '@faker-js/faker';
import { prisma } from '@/lib/prisma';
import type { User, Project, Transaction, Review, Message } from '@prisma/client';

/**
 * Create a test user
 * Generates realistic data with faker
 */
export async function createTestUser(
  overrides: Partial<{
    email: string;
    username: string;
    fullName: string;
    isSeller: boolean;
    isBuyer: boolean;
    isVerifiedSeller: boolean;
    stripeAccountId: string;
    githubId: string;
  }> = {}
): Promise<User> {
  const username = overrides.username || faker.internet.username().toLowerCase();

  return await prisma.user.create({
    data: {
      email: overrides.email || faker.internet.email(),
      username,
      fullName: overrides.fullName || faker.person.fullName(),
      bio: faker.person.bio(),
      avatarUrl: faker.image.avatar(),
      isSeller: overrides.isSeller ?? false,
      isBuyer: overrides.isBuyer ?? true,
      isVerifiedSeller: overrides.isVerifiedSeller ?? false,
      stripeAccountId: overrides.stripeAccountId || null,
      githubId: overrides.githubId || faker.string.numeric(8),
      githubUsername: username,
      githubAvatarUrl: faker.image.avatar(),
    },
  });
}

/**
 * Create a test seller
 * Convenience wrapper for createTestUser with seller flags
 */
export async function createTestSeller(
  overrides: Partial<{
    email: string;
    username: string;
    isVerifiedSeller: boolean;
    stripeAccountId: string;
  }> = {}
): Promise<User> {
  return await createTestUser({
    ...overrides,
    isSeller: true,
    isVerifiedSeller: overrides.isVerifiedSeller ?? true,
    stripeAccountId: overrides.stripeAccountId || `acct_${faker.string.alphanumeric(16)}`,
  });
}

/**
 * Create a test project
 */
export async function createTestProject(
  overrides: Partial<{
    sellerId: string;
    title: string;
    description: string;
    category: string;
    completionPercentage: number;
    priceCents: number;
    status: string;
    techStack: string[];
    primaryLanguage: string;
    githubUrl: string;
    demoUrl: string;
    thumbnailImageUrl: string;
    screenshotUrls: string[];
    isFeatured: boolean;
  }> = {}
): Promise<Project> {
  // If no sellerId provided, create a seller
  let sellerId = overrides.sellerId;
  if (!sellerId) {
    const seller = await createTestSeller();
    sellerId = seller.id;
  }

  return await prisma.project.create({
    data: {
      sellerId,
      title: overrides.title || faker.commerce.productName(),
      description:
        overrides.description ||
        faker.lorem.paragraphs(3, '\n\n') +
          '\n\n## Features\n' +
          Array.from({ length: 5 }, () => `- ${faker.lorem.sentence()}`).join('\n'),
      category: overrides.category || faker.helpers.arrayElement(['web_app', 'mobile', 'backend', 'tool', 'dashboard']),
      completionPercentage: overrides.completionPercentage ?? faker.number.int({ min: 50, max: 95 }),
      estimatedCompletionHours: faker.number.int({ min: 10, max: 200 }),
      knownIssues: faker.lorem.paragraph(),
      priceCents: overrides.priceCents ?? faker.number.int({ min: 5000, max: 500000 }),
      licenseType: 'full_code',
      accessLevel: 'full',
      techStack:
        overrides.techStack ||
        faker.helpers.arrayElements(
          ['React', 'Next.js', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'Prisma'],
          { min: 3, max: 5 }
        ),
      primaryLanguage: overrides.primaryLanguage || 'TypeScript',
      frameworks: ['Next.js', 'Tailwind CSS'],
      githubUrl: overrides.githubUrl || `https://github.com/${faker.internet.username()}/${faker.lorem.slug()}`,
      demoUrl: overrides.demoUrl || faker.internet.url(),
      thumbnailImageUrl: overrides.thumbnailImageUrl || faker.image.urlLoremFlickr({ category: 'tech' }),
      screenshotUrls: overrides.screenshotUrls || [
        faker.image.urlLoremFlickr({ category: 'tech' }),
        faker.image.urlLoremFlickr({ category: 'tech' }),
        faker.image.urlLoremFlickr({ category: 'tech' }),
      ],
      status: overrides.status || 'active',
      isFeatured: overrides.isFeatured ?? false,
      viewCount: faker.number.int({ min: 0, max: 1000 }),
      favoriteCount: faker.number.int({ min: 0, max: 50 }),
      messageCount: faker.number.int({ min: 0, max: 20 }),
      isApproved: true,
    },
  });
}

/**
 * Create a test transaction
 */
export async function createTestTransaction(
  overrides: Partial<{
    projectId: string;
    sellerId: string;
    buyerId: string;
    amountCents: number;
    commissionCents: number;
    sellerReceivesCents: number;
    paymentStatus: string;
    escrowStatus: string;
    stripePaymentIntentId: string;
  }> = {}
): Promise<Transaction> {
  // Create required entities if not provided
  let projectId = overrides.projectId;
  let sellerId = overrides.sellerId;
  let buyerId = overrides.buyerId;

  if (!projectId || !sellerId) {
    const project = await createTestProject({ sellerId });
    projectId = project.id;
    sellerId = project.sellerId;
  }

  if (!buyerId) {
    const buyer = await createTestUser();
    buyerId = buyer.id;
  }

  const amountCents = overrides.amountCents ?? 100000; // $1,000.00
  const commissionCents = overrides.commissionCents ?? Math.round(amountCents * 0.18);
  const sellerReceivesCents = overrides.sellerReceivesCents ?? amountCents - commissionCents;

  return await prisma.transaction.create({
    data: {
      projectId,
      sellerId,
      buyerId,
      amountCents,
      commissionCents,
      sellerReceivesCents,
      paymentStatus: overrides.paymentStatus || 'succeeded',
      escrowStatus: overrides.escrowStatus || 'held',
      stripePaymentIntentId: overrides.stripePaymentIntentId || `pi_${faker.string.alphanumeric(24)}`,
      stripeChargeId: `ch_${faker.string.alphanumeric(24)}`,
      escrowReleaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      codeDeliveryStatus: 'delivered',
      codeZipUrl: faker.internet.url(),
    },
  });
}

/**
 * Create a test review
 */
export async function createTestReview(
  overrides: Partial<{
    transactionId: string;
    sellerId: string;
    buyerId: string;
    overallRating: number;
    comment: string;
    codeQualityRating: number;
    documentationRating: number;
    responsivenessRating: number;
    accuracyRating: number;
  }> = {}
): Promise<Review> {
  // Create transaction if not provided
  let transactionId = overrides.transactionId;
  let sellerId = overrides.sellerId;
  let buyerId = overrides.buyerId;

  if (!transactionId) {
    const transaction = await createTestTransaction();
    transactionId = transaction.id;
    sellerId = transaction.sellerId;
    buyerId = transaction.buyerId;
  }

  return await prisma.review.create({
    data: {
      transactionId,
      sellerId: sellerId!,
      buyerId: buyerId!,
      overallRating: overrides.overallRating ?? faker.number.int({ min: 3, max: 5 }),
      comment: overrides.comment || faker.lorem.paragraph(),
      codeQualityRating: overrides.codeQualityRating ?? faker.number.int({ min: 3, max: 5 }),
      documentationRating: overrides.documentationRating ?? faker.number.int({ min: 3, max: 5 }),
      responsivenessRating: overrides.responsivenessRating ?? faker.number.int({ min: 3, max: 5 }),
      accuracyRating: overrides.accuracyRating ?? faker.number.int({ min: 3, max: 5 }),
      isAnonymous: false,
      helpfulCount: faker.number.int({ min: 0, max: 10 }),
    },
  });
}

/**
 * Create a test message
 */
export async function createTestMessage(
  overrides: Partial<{
    senderId: string;
    recipientId: string;
    projectId: string;
    transactionId: string;
    content: string;
    isRead: boolean;
  }> = {}
): Promise<Message> {
  // Create users if not provided
  let senderId = overrides.senderId;
  let recipientId = overrides.recipientId;

  if (!senderId) {
    const sender = await createTestUser();
    senderId = sender.id;
  }

  if (!recipientId) {
    const recipient = await createTestUser();
    recipientId = recipient.id;
  }

  return await prisma.message.create({
    data: {
      senderId,
      recipientId,
      projectId: overrides.projectId || null,
      transactionId: overrides.transactionId || null,
      content: overrides.content || faker.lorem.sentences(3),
      isRead: overrides.isRead ?? false,
    },
  });
}

/**
 * Create a complete test scenario with user, project, transaction, and review
 * Useful for complex integration tests
 */
export async function createCompleteTestScenario() {
  const seller = await createTestSeller();
  const buyer = await createTestUser();
  const project = await createTestProject({ sellerId: seller.id });
  const transaction = await createTestTransaction({
    projectId: project.id,
    sellerId: seller.id,
    buyerId: buyer.id,
  });
  const review = await createTestReview({
    transactionId: transaction.id,
    sellerId: seller.id,
    buyerId: buyer.id,
  });

  return {
    seller,
    buyer,
    project,
    transaction,
    review,
  };
}
