-- AlterTable: add onboarding_dismissed_at to users
ALTER TABLE "users" ADD COLUMN "onboarding_dismissed_at" TIMESTAMP(3);
