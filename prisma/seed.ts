/**
 * Database Seeding Script
 *
 * Responsibilities:
 * - Populate database with realistic test data for development
 * - Create users, projects, transactions, reviews, messages, favorites
 * - Idempotent (can run multiple times without duplicating data)
 * - Uses Faker for realistic fake data
 *
 * Architecture:
 * - DatabaseSeeder class encapsulates seeding logic (SRP)
 * - Each entity has its own seeding method
 * - Proper error handling and logging
 *
 * Usage: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

/**
 * Tech stacks and categories for realistic project data
 */
const TECH_STACKS = [
  ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'PostgreSQL'],
  ['Vue.js', 'Nuxt', 'TypeScript', 'Firebase'],
  ['React', 'Node.js', 'Express', 'MongoDB'],
  ['Django', 'Python', 'PostgreSQL', 'Redis'],
  ['Ruby on Rails', 'PostgreSQL', 'Sidekiq'],
  ['Laravel', 'PHP', 'MySQL', 'Vue.js'],
  ['Go', 'Gin', 'PostgreSQL', 'Redis'],
  ['Rust', 'Actix', 'PostgreSQL'],
  ['Flutter', 'Dart', 'Firebase'],
  ['React Native', 'TypeScript', 'Expo'],
];

const FRAMEWORKS = [
  ['Next.js', 'Express', 'Tailwind'],
  ['Nuxt', 'Vuetify'],
  ['Django', 'DRF'],
  ['Rails', 'Devise'],
  ['Laravel', 'Livewire'],
  ['Gin', 'GORM'],
  ['Actix-web'],
  ['Flutter', 'GetX'],
  ['Expo', 'NativeBase'],
];

const CATEGORIES = [
  'web_app',
  'mobile',
  'backend',
  'tool',
  'dashboard',
  'api',
  'chrome_extension',
  'desktop_app',
];

const PRIMARY_LANGUAGES = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Go',
  'Rust',
  'Ruby',
  'PHP',
  'Dart',
];

const LICENSE_TYPES = ['full_code', 'limited', 'custom'];
const ACCESS_LEVELS = ['full', 'read_only', 'zip_download'];

/**
 * DatabaseSeeder - Manages database seeding process
 */
class DatabaseSeeder {
  private prisma: PrismaClient;

  constructor(client: PrismaClient) {
    this.prisma = client;
  }

  /**
   * Main seeding method - orchestrates all seeding
   */
  async seed() {
    console.info('[DatabaseSeeder] Starting database seeding...\n');

    try {
      // Clear existing data (development only!)
      await this.clearDatabase();

      // Create test data
      const users = await this.seedUsers(20); // 20 users
      const projects = await this.seedProjects(users, 50); // 50 projects
      const transactions = await this.seedTransactions(users, projects, 15); // 15 transactions
      await this.seedReviews(transactions, 10); // 10 reviews
      await this.seedMessages(users, projects, 30); // 30 messages
      await this.seedFavorites(users, projects, 40); // 40 favorites
      await this.seedSellerAnalytics(users);

      console.info('\n[DatabaseSeeder] ✅ Database seeding completed successfully!\n');
      console.info('Summary:');
      console.info(`  - ${users.length} users created`);
      console.info(`  - ${projects.length} projects created`);
      console.info(`  - ${transactions.length} transactions created`);
      console.info(`  - 10 reviews created`);
      console.info(`  - 30 messages created`);
      console.info(`  - 40 favorites created`);
      console.info(
        `  - ${users.filter((u) => u.isSeller).length} seller analytics created\n`
      );
    } catch (error) {
      console.error('[DatabaseSeeder] ❌ Seeding failed:', error);
      throw error;
    }
  }

  /**
   * Clear all data from database (development only!)
   */
  private async clearDatabase() {
    console.info('[DatabaseSeeder] Clearing existing data...');

    // Delete in correct order (respect foreign key constraints)
    await this.prisma.review.deleteMany();
    await this.prisma.message.deleteMany();
    await this.prisma.favorite.deleteMany();
    await this.prisma.transaction.deleteMany();
    await this.prisma.project.deleteMany();
    await this.prisma.sellerAnalytics.deleteMany();
    await this.prisma.session.deleteMany();
    await this.prisma.account.deleteMany();
    await this.prisma.user.deleteMany();

    console.info('[DatabaseSeeder] ✓ Database cleared\n');
  }

  /**
   * Seed users with realistic data
   */
  private async seedUsers(count: number) {
    console.info(`[DatabaseSeeder] Creating ${count} users...`);

    const users = [];

    for (let i = 0; i < count; i++) {
      const isSeller = i < count * 0.7; // 70% are sellers
      const isVerified = isSeller && Math.random() > 0.5; // 50% of sellers verified

      const user = await this.prisma.user.create({
        data: {
          email: faker.internet.email().toLowerCase(),
          username: faker.internet.username().toLowerCase(),
          fullName: faker.person.fullName(),
          bio: Math.random() > 0.3 ? faker.person.bio() : null,
          avatarUrl: faker.image.avatar(),
          isSeller,
          isBuyer: true,
          githubId: faker.string.numeric(8),
          githubUsername: faker.internet.username(),
          githubAvatarUrl: faker.image.avatar(),
          payoutMethod: isSeller
            ? faker.helpers.arrayElement(['stripe', 'paypal'])
            : null,
          payoutEmail: isSeller ? faker.internet.email() : null,
          isVerifiedSeller: isVerified,
          sellerVerificationDate: isVerified ? faker.date.past() : null,
          createdAt: faker.date.past({ years: 1 }),
          lastLogin: faker.date.recent(),
        },
      });

      users.push(user);
    }

    console.info(`[DatabaseSeeder] ✓ Created ${users.length} users\n`);
    return users;
  }

  /**
   * Seed projects with realistic data
   */
  private async seedProjects(users: any[], count: number) {
    console.info(`[DatabaseSeeder] Creating ${count} projects...`);

    const sellers = users.filter((u) => u.isSeller);
    const projects = [];

    for (let i = 0; i < count; i++) {
      const seller = faker.helpers.arrayElement(sellers);
      const techStack = faker.helpers.arrayElement(TECH_STACKS);
      const frameworks = faker.helpers.arrayElement(FRAMEWORKS);
      const completionPercentage = faker.number.int({ min: 50, max: 95 });
      const priceCents = faker.number.int({ min: 50000, max: 500000 }); // $500 - $5000

      const statuses = ['draft', 'active', 'sold', 'delisted'];
      const weights = [0.1, 0.7, 0.15, 0.05]; // 70% active, 15% sold, etc.
      const status = faker.helpers.weightedArrayElement(
        statuses.map((s, idx) => ({ weight: weights[idx]!, value: s }))
      );

      const project = await this.prisma.project.create({
        data: {
          sellerId: seller.id,
          title: faker.company.catchPhrase(),
          description: faker.lorem.paragraphs(3),
          category: faker.helpers.arrayElement(CATEGORIES),
          completionPercentage,
          estimatedCompletionHours: faker.number.int({ min: 5, max: 100 }),
          knownIssues:
            Math.random() > 0.5
              ? faker.lorem.paragraph()
              : 'No known issues at this time.',
          priceCents,
          licenseType: faker.helpers.arrayElement(LICENSE_TYPES),
          accessLevel: faker.helpers.arrayElement(ACCESS_LEVELS),
          techStack,
          primaryLanguage: faker.helpers.arrayElement(PRIMARY_LANGUAGES),
          frameworks,
          githubUrl: `https://github.com/${faker.internet.username()}/${faker.lorem.slug()}`,
          githubRepoName: faker.lorem.slug(),
          demoUrl: Math.random() > 0.5 ? faker.internet.url() : null,
          thumbnailImageUrl: faker.image.url(),
          screenshotUrls: Array.from(
            { length: faker.number.int({ min: 1, max: 5 }) },
            () => faker.image.url()
          ),
          status,
          isFeatured: Math.random() > 0.9, // 10% featured
          viewCount: faker.number.int({ min: 0, max: 5000 }),
          favoriteCount: faker.number.int({ min: 0, max: 200 }),
          messageCount: faker.number.int({ min: 0, max: 50 }),
          createdAt: faker.date.past({ years: 1 }),
        },
      });

      projects.push(project);
    }

    console.info(`[DatabaseSeeder] ✓ Created ${projects.length} projects\n`);
    return projects;
  }

  /**
   * Seed transactions
   */
  private async seedTransactions(users: any[], projects: any[], count: number) {
    console.info(`[DatabaseSeeder] Creating ${count} transactions...`);

    const buyers = users.filter((u) => u.isBuyer);
    const soldProjects = projects.filter((p) => p.status === 'sold');
    const transactions = [];

    for (let i = 0; i < count && i < soldProjects.length; i++) {
      const project = soldProjects[i]!;
      const buyer = faker.helpers.arrayElement(
        buyers.filter((b) => b.id !== project.sellerId)
      );

      const commissionRate = 0.18;
      const commissionCents = Math.round(project.priceCents * commissionRate);
      const sellerReceivesCents = project.priceCents - commissionCents;

      const transaction = await this.prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: project.sellerId,
          buyerId: buyer.id,
          amountCents: project.priceCents,
          commissionCents,
          sellerReceivesCents,
          stripePaymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
          stripeChargeId: `ch_${faker.string.alphanumeric(24)}`,
          paymentStatus: 'succeeded',
          escrowStatus: faker.helpers.arrayElement(['held', 'released']),
          escrowReleaseDate: faker.date.future(),
          releasedToSellerAt: Math.random() > 0.5 ? faker.date.recent() : null,
          codeDeliveryStatus: 'delivered',
          codeZipUrl: `https://r2.example.com/${faker.string.uuid()}.zip`,
          codeAccessedAt: faker.date.recent(),
          createdAt: faker.date.past({ months: 6 }),
          completedAt: faker.date.recent(),
        },
      });

      transactions.push(transaction);
    }

    console.info(`[DatabaseSeeder] ✓ Created ${transactions.length} transactions\n`);
    return transactions;
  }

  /**
   * Seed reviews
   */
  private async seedReviews(transactions: any[], count: number) {
    console.info(`[DatabaseSeeder] Creating ${count} reviews...`);

    for (let i = 0; i < count && i < transactions.length; i++) {
      const transaction = transactions[i]!;

      await this.prisma.review.create({
        data: {
          transactionId: transaction.id,
          sellerId: transaction.sellerId,
          buyerId: transaction.buyerId,
          overallRating: faker.number.int({ min: 3, max: 5 }), // Mostly positive
          comment: faker.lorem.paragraph(),
          codeQualityRating: faker.number.int({ min: 3, max: 5 }),
          documentationRating: faker.number.int({ min: 2, max: 5 }),
          responsivenessRating: faker.number.int({ min: 3, max: 5 }),
          accuracyRating: faker.number.int({ min: 3, max: 5 }),
          isAnonymous: Math.random() > 0.8,
          helpfulCount: faker.number.int({ min: 0, max: 20 }),
          createdAt: faker.date.recent(),
        },
      });
    }

    console.info(`[DatabaseSeeder] ✓ Created ${count} reviews\n`);
  }

  /**
   * Seed messages
   */
  private async seedMessages(users: any[], projects: any[], count: number) {
    console.info(`[DatabaseSeeder] Creating ${count} messages...`);

    for (let i = 0; i < count; i++) {
      const sender = faker.helpers.arrayElement(users);
      const recipient = faker.helpers.arrayElement(
        users.filter((u) => u.id !== sender.id)
      );
      const project = Math.random() > 0.3 ? faker.helpers.arrayElement(projects) : null;

      await this.prisma.message.create({
        data: {
          senderId: sender.id,
          recipientId: recipient.id,
          projectId: project?.id || null,
          content: faker.lorem.paragraph(),
          isRead: Math.random() > 0.4,
          readAt: Math.random() > 0.5 ? faker.date.recent() : null,
          createdAt: faker.date.recent(),
        },
      });
    }

    console.info(`[DatabaseSeeder] ✓ Created ${count} messages\n`);
  }

  /**
   * Seed favorites
   */
  private async seedFavorites(users: any[], projects: any[], count: number) {
    console.info(`[DatabaseSeeder] Creating ${count} favorites...`);

    const activeProjects = projects.filter((p) => p.status === 'active');

    for (let i = 0; i < count; i++) {
      const user = faker.helpers.arrayElement(users);
      const project = faker.helpers.arrayElement(activeProjects);

      try {
        await this.prisma.favorite.create({
          data: {
            userId: user.id,
            projectId: project.id,
            createdAt: faker.date.recent(),
          },
        });
      } catch (error) {
        // Skip duplicates (unique constraint)
        continue;
      }
    }

    console.info(`[DatabaseSeeder] ✓ Created favorites\n`);
  }

  /**
   * Seed seller analytics
   */
  private async seedSellerAnalytics(users: any[]) {
    console.info('[DatabaseSeeder] Creating seller analytics...');

    const sellers = users.filter((u) => u.isSeller);

    for (const seller of sellers) {
      const projects = await this.prisma.project.findMany({
        where: { sellerId: seller.id },
      });

      const transactions = await this.prisma.transaction.findMany({
        where: { sellerId: seller.id, paymentStatus: 'succeeded' },
      });

      const reviews = await this.prisma.review.findMany({
        where: { sellerId: seller.id },
      });

      const totalRevenueCents = transactions.reduce(
        (sum, t) => sum + t.sellerReceivesCents,
        0
      );

      const averageRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length
          : null;

      await this.prisma.sellerAnalytics.create({
        data: {
          sellerId: seller.id,
          totalProjectsListed: projects.length,
          totalProjectsSold: projects.filter((p) => p.status === 'sold').length,
          totalRevenueCents,
          averageRating: averageRating ? parseFloat(averageRating.toFixed(2)) : null,
          totalReviews: reviews.length,
          totalFavorites: projects.reduce((sum, p) => sum + p.favoriteCount, 0),
          totalViews: projects.reduce((sum, p) => sum + p.viewCount, 0),
        },
      });
    }

    console.info(
      `[DatabaseSeeder] ✓ Created seller analytics for ${sellers.length} sellers\n`
    );
  }
}

/**
 * Main execution
 */
async function main() {
  const seeder = new DatabaseSeeder(prisma);
  await seeder.seed();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
