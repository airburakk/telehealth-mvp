-- Additive technical monitoring only. Does not publish content or grant reviewers.
BEGIN;
CREATE TABLE "FamilyMedicineSourceCheck" (
  "sourceKey" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "baselineHash" TEXT,
  "contentHash" TEXT,
  "checkedAt" TIMESTAMP(3) NOT NULL,
  "lastSuccessAt" TIMESTAMP(3),
  "changedAt" TIMESTAMP(3),
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "errorTag" TEXT,
  "httpStatus" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyMedicineSourceCheck_pkey" PRIMARY KEY ("sourceKey"),
  CONSTRAINT "FamilyMedicineSourceCheck_status_check" CHECK ("status" IN ('baseline', 'current', 'changed', 'unreachable')),
  CONSTRAINT "FamilyMedicineSourceCheck_failures_check" CHECK ("consecutiveFailures" >= 0)
);
CREATE INDEX "FamilyMedicineSourceCheck_status_checkedAt_idx" ON "FamilyMedicineSourceCheck"("status", "checkedAt");
COMMIT;
