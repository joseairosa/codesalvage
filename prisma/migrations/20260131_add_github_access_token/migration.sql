-- AlterTable: Add GitHub access token fields to users table
ALTER TABLE "users" ADD COLUMN "github_access_token" TEXT;
ALTER TABLE "users" ADD COLUMN "github_connected_at" TIMESTAMP(3);
