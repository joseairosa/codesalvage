-- CreateTable
CREATE TABLE "project_view_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_view_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_view_events_project_id_created_at_idx" ON "project_view_events"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "project_view_events" ADD CONSTRAINT "project_view_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
