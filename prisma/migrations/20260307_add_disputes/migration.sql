-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolution" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disputes_transaction_id_key" ON "disputes"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_dispute_transaction_id" ON "disputes"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_dispute_buyer_id" ON "disputes"("buyer_id");

-- CreateIndex
CREATE INDEX "idx_dispute_status" ON "disputes"("status");

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
