-- AlterTable: Add firebase_uid column to users table
ALTER TABLE "users" ADD COLUMN "firebase_uid" TEXT;

-- CreateIndex: Unique index on firebase_uid
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex: Lookup index on firebase_uid
CREATE INDEX "idx_firebase_uid" ON "users"("firebase_uid");

-- CreateTable: API Keys for programmatic access
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique index on key_hash
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex: Lookup indexes on api_keys
CREATE INDEX "idx_api_key_user_id" ON "api_keys"("user_id");
CREATE INDEX "idx_api_key_hash" ON "api_keys"("key_hash");
CREATE INDEX "idx_api_key_status" ON "api_keys"("status");

-- AddForeignKey: api_keys.user_id -> users.id
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
