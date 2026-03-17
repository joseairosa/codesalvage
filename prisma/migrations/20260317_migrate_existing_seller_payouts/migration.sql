-- Data Migration: Create SellerPayoutDetails from existing User payout fields
-- NOTE: Using gen_random_uuid() here instead of ULID (app-only generation). Both are valid text PKs.

INSERT INTO "seller_payout_details" ("id", "user_id", "payout_method", "payout_email", "is_active", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  "id",
  "payout_method",
  "payout_email",
  true,
  now(),
  now()
FROM "users"
WHERE "payout_email" IS NOT NULL
  AND "payout_method" IS NOT NULL
ON CONFLICT ("user_id") DO NOTHING;

-- Verification count
DO $$
DECLARE
  migrated INT;
  source INT;
BEGIN
  SELECT count(*) INTO source FROM "users" WHERE "payout_email" IS NOT NULL AND "payout_method" IS NOT NULL;
  SELECT count(*) INTO migrated FROM "seller_payout_details";
  RAISE NOTICE 'Migrated % of % sellers', migrated, source;
END $$;
