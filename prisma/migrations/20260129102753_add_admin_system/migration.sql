-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "banned_at" TIMESTAMP(3),
ADD COLUMN     "banned_reason" TEXT,
ADD COLUMN     "banned_by" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "featured_by" TEXT,
ADD COLUMN     "featured_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_is_admin" ON "users"("is_admin");

-- CreateIndex
CREATE INDEX "idx_is_banned" ON "users"("is_banned");

-- CreateIndex
CREATE INDEX "idx_approved_by" ON "projects"("approved_by");

-- CreateIndex
CREATE INDEX "idx_admin_audit_admin_id" ON "admin_audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX "idx_admin_audit_target" ON "admin_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_admin_audit_created_at" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_content_report_reporter_id" ON "content_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "idx_content_report_content" ON "content_reports"("content_type", "content_id");

-- CreateIndex
CREATE INDEX "idx_content_report_status" ON "content_reports"("status");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
