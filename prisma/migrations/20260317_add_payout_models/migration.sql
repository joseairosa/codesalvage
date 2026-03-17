-- CreateTable
CREATE TABLE "seller_payout_details" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payout_method" TEXT NOT NULL,
    "payout_email" TEXT NOT NULL,
    "payout_details" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_payout_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL,
    "payout_method" TEXT NOT NULL,
    "payout_email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "external_reference" TEXT,
    "batch_id" TEXT,
    "processed_at" TIMESTAMP(3),
    "processed_by" TEXT,
    "failed_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_payout_details_user_id_key" ON "seller_payout_details"("user_id");

-- CreateIndex
CREATE INDEX "idx_seller_payout_user_id" ON "seller_payout_details"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_requests_transaction_id_key" ON "payout_requests"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_payout_request_status" ON "payout_requests"("status");

-- CreateIndex
CREATE INDEX "idx_payout_request_seller_id" ON "payout_requests"("seller_id");

-- CreateIndex
CREATE INDEX "idx_payout_request_batch_id" ON "payout_requests"("batch_id");

-- AddForeignKey
ALTER TABLE "seller_payout_details" ADD CONSTRAINT "seller_payout_details_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
