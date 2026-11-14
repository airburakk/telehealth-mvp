-- Additive migration only. Does not alter existing student or clinical tables.
CREATE TABLE "StudentClubEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "organizer" TEXT NOT NULL,
  "venue" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "startDay" TEXT NOT NULL,
  "endDay" TEXT NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'VERIFIED',
  "checkedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StudentClubEvent_sourceUrl_key" ON "StudentClubEvent"("sourceUrl");
CREATE INDEX "StudentClubEvent_status_endDay_checkedAt_idx" ON "StudentClubEvent"("status", "endDay", "checkedAt");
