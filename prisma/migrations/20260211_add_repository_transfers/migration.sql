-- CreateTable
CREATE TABLE "repository_transfers" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "github_repo_full_name" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'github_collaborator',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "github_invitation_id" TEXT,
    "seller_github_username" TEXT NOT NULL,
    "buyer_github_username" TEXT,
    "initiated_at" TIMESTAMP(3),
    "invitation_sent_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repository_transfers_transaction_id_key" ON "repository_transfers"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_repo_transfer_transaction_id" ON "repository_transfers"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_repo_transfer_status" ON "repository_transfers"("status");

-- AddForeignKey
ALTER TABLE "repository_transfers" ADD CONSTRAINT "repository_transfers_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
