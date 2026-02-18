-- Add ownership transfer timing fields to repository_transfers
ALTER TABLE "repository_transfers" ADD COLUMN "transfer_initiated_at" TIMESTAMP(3);
ALTER TABLE "repository_transfers" ADD COLUMN "ownership_transferred_at" TIMESTAMP(3);
