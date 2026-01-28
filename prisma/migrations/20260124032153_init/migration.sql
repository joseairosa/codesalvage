-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "username" TEXT NOT NULL,
    "full_name" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "is_seller" BOOLEAN NOT NULL DEFAULT false,
    "is_buyer" BOOLEAN NOT NULL DEFAULT true,
    "github_id" TEXT,
    "github_username" TEXT,
    "github_avatar_url" TEXT,
    "payout_method" TEXT,
    "payout_email" TEXT,
    "stripe_account_id" TEXT,
    "tax_id" TEXT,
    "is_verified_seller" BOOLEAN NOT NULL DEFAULT false,
    "seller_verification_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "completion_percentage" INTEGER NOT NULL,
    "estimated_completion_hours" INTEGER,
    "known_issues" TEXT,
    "price_cents" INTEGER NOT NULL,
    "license_type" TEXT NOT NULL,
    "access_level" TEXT NOT NULL,
    "tech_stack" TEXT[],
    "primary_language" TEXT,
    "frameworks" TEXT[],
    "github_url" TEXT,
    "github_repo_name" TEXT,
    "demo_url" TEXT,
    "documentation_url" TEXT,
    "thumbnail_image_url" TEXT,
    "screenshot_urls" TEXT[],
    "demo_video_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "featured_until" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL,
    "seller_receives_cents" INTEGER NOT NULL,
    "stripe_payment_intent_id" TEXT,
    "stripe_charge_id" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "escrow_status" TEXT NOT NULL DEFAULT 'pending',
    "escrow_release_date" TIMESTAMP(3),
    "released_to_seller_at" TIMESTAMP(3),
    "code_delivery_status" TEXT NOT NULL DEFAULT 'pending',
    "code_zip_url" TEXT,
    "code_accessed_at" TIMESTAMP(3),
    "github_access_granted_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "comment" TEXT,
    "code_quality_rating" INTEGER,
    "documentation_rating" INTEGER,
    "responsiveness_rating" INTEGER,
    "accuracy_rating" INTEGER,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "project_id" TEXT,
    "transaction_id" TEXT,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_analytics" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "total_projects_listed" INTEGER NOT NULL DEFAULT 0,
    "total_projects_sold" INTEGER NOT NULL DEFAULT 0,
    "total_revenue_cents" INTEGER NOT NULL DEFAULT 0,
    "average_rating" DECIMAL(3,2),
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "total_favorites" INTEGER NOT NULL DEFAULT 0,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_account_id_key" ON "users"("stripe_account_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_github_id" ON "users"("github_id");

-- CreateIndex
CREATE INDEX "idx_is_seller" ON "users"("is_seller");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "idx_seller_id" ON "projects"("seller_id");

-- CreateIndex
CREATE INDEX "idx_status" ON "projects"("status");

-- CreateIndex
CREATE INDEX "idx_category" ON "projects"("category");

-- CreateIndex
CREATE INDEX "idx_completion" ON "projects"("completion_percentage");

-- CreateIndex
CREATE INDEX "idx_primary_language" ON "projects"("primary_language");

-- CreateIndex
CREATE INDEX "idx_price" ON "projects"("price_cents");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_stripe_payment_intent_id_key" ON "transactions"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "idx_project_id" ON "transactions"("project_id");

-- CreateIndex
CREATE INDEX "idx_transaction_seller_id" ON "transactions"("seller_id");

-- CreateIndex
CREATE INDEX "idx_buyer_id" ON "transactions"("buyer_id");

-- CreateIndex
CREATE INDEX "idx_escrow_status" ON "transactions"("escrow_status");

-- CreateIndex
CREATE INDEX "idx_payment_status" ON "transactions"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_transaction_id_key" ON "reviews"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_review_seller_id" ON "reviews"("seller_id");

-- CreateIndex
CREATE INDEX "idx_review_buyer_id" ON "reviews"("buyer_id");

-- CreateIndex
CREATE INDEX "idx_sender_id" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "idx_recipient_id" ON "messages"("recipient_id");

-- CreateIndex
CREATE INDEX "idx_is_read" ON "messages"("is_read");

-- CreateIndex
CREATE INDEX "idx_message_project_id" ON "messages"("project_id");

-- CreateIndex
CREATE INDEX "idx_message_transaction_id" ON "messages"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_favorite_user_id" ON "favorites"("user_id");

-- CreateIndex
CREATE INDEX "idx_favorite_project_id" ON "favorites"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_project_id_key" ON "favorites"("user_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_analytics_seller_id_key" ON "seller_analytics"("seller_id");

-- CreateIndex
CREATE INDEX "idx_seller_analytics_seller_id" ON "seller_analytics"("seller_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_analytics" ADD CONSTRAINT "seller_analytics_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
