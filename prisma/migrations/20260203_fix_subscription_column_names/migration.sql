-- RenameColumns: Fix subscriptions table column names to match Prisma @map directives
-- The original migration created camelCase columns but the schema expects snake_case

ALTER TABLE "subscriptions" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "subscriptions" RENAME COLUMN "stripeSubscriptionId" TO "stripe_subscription_id";
ALTER TABLE "subscriptions" RENAME COLUMN "stripeCustomerId" TO "stripe_customer_id";
ALTER TABLE "subscriptions" RENAME COLUMN "stripePriceId" TO "stripe_price_id";
ALTER TABLE "subscriptions" RENAME COLUMN "currentPeriodStart" TO "current_period_start";
ALTER TABLE "subscriptions" RENAME COLUMN "currentPeriodEnd" TO "current_period_end";
ALTER TABLE "subscriptions" RENAME COLUMN "cancelAtPeriodEnd" TO "cancel_at_period_end";
ALTER TABLE "subscriptions" RENAME COLUMN "canceledAt" TO "canceled_at";
ALTER TABLE "subscriptions" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "subscriptions" RENAME COLUMN "updatedAt" TO "updated_at";
