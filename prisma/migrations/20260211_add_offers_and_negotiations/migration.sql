-- AlterTable: Add minimumOfferCents to projects
ALTER TABLE "projects" ADD COLUMN "minimum_offer_cents" INTEGER;

-- CreateTable: offers
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "offered_price_cents" INTEGER NOT NULL,
    "original_price_cents" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "responded_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "transaction_id" TEXT,
    "parent_offer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offers_transaction_id_key" ON "offers"("transaction_id");
CREATE UNIQUE INDEX "offers_parent_offer_id_key" ON "offers"("parent_offer_id");
CREATE INDEX "idx_offer_buyer_id" ON "offers"("buyer_id");
CREATE INDEX "idx_offer_seller_id" ON "offers"("seller_id");
CREATE INDEX "idx_offer_project_id" ON "offers"("project_id");
CREATE INDEX "idx_offer_status" ON "offers"("status");
CREATE INDEX "idx_offer_expires_at" ON "offers"("expires_at");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_parent_offer_id_fkey" FOREIGN KEY ("parent_offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
