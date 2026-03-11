-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" TEXT,
    "user_agent" TEXT,
    "admin_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_feedback_status" ON "feedbacks"("status");

-- CreateIndex
CREATE INDEX "idx_feedback_type" ON "feedbacks"("type");

-- CreateIndex
CREATE INDEX "idx_feedback_priority" ON "feedbacks"("priority");

-- CreateIndex
CREATE INDEX "idx_feedback_user_id" ON "feedbacks"("user_id");

-- CreateIndex
CREATE INDEX "idx_feedback_created_at" ON "feedbacks"("created_at");

-- RenameForeignKey
ALTER TABLE "subscriptions" RENAME CONSTRAINT "subscriptions_userId_fkey" TO "subscriptions_user_id_fkey";

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "subscriptions_status_idx" RENAME TO "idx_subscription_status";

-- RenameIndex
ALTER INDEX "subscriptions_stripeSubscriptionId_idx" RENAME TO "idx_subscription_stripe_id";

-- RenameIndex
ALTER INDEX "subscriptions_stripeSubscriptionId_key" RENAME TO "subscriptions_stripe_subscription_id_key";

-- RenameIndex
ALTER INDEX "subscriptions_userId_idx" RENAME TO "idx_subscription_user_id";

-- RenameIndex
ALTER INDEX "subscriptions_userId_key" RENAME TO "subscriptions_user_id_key";
