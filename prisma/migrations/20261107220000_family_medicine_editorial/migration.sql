BEGIN;
CREATE TABLE "FamilyMedicineEditorial" (
 "workflowId" TEXT PRIMARY KEY, "catalogHash" TEXT NOT NULL, "sourceFingerprint" TEXT, "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
 "evidence" JSONB NOT NULL, "clinicalById" TEXT, "clinicalAt" TIMESTAMP(3),
 "legalById" TEXT, "legalAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "FamilyMedicineEditorialEvent" (
 "id" TEXT PRIMARY KEY, "workflowId" TEXT NOT NULL, "revision" INTEGER NOT NULL,
 "action" TEXT NOT NULL CHECK ("action" IN ('save','review:clinical','review:legal','revoke:clinical','revoke:legal')),
 "actorId" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "snapshotHash" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FamilyMedicineEditorialEvent_workflowId_revision_key" ON "FamilyMedicineEditorialEvent"("workflowId", "revision");
CREATE INDEX "FamilyMedicineEditorialEvent_workflowId_createdAt_idx" ON "FamilyMedicineEditorialEvent"("workflowId", "createdAt");
CREATE TABLE "FamilyMedicineReviewerGrant" (
 "userId" TEXT NOT NULL, "discipline" TEXT NOT NULL CHECK ("discipline" IN ('clinical','legal')),
 "qualificationReference" TEXT NOT NULL CHECK (length(trim("qualificationReference")) > 0),
 "grantedById" TEXT NOT NULL, "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
 PRIMARY KEY ("userId", "discipline"), CHECK ("expiresAt" > "grantedAt")
);
-- This ledger is immutable through the ordinary application connection. DB owners
-- can still change schema: this is not a claim of external/notarized tamper proofing.
CREATE FUNCTION family_medicine_editorial_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Family medicine editorial events are append-only'; END;
$$;
CREATE TRIGGER family_medicine_editorial_no_update_delete BEFORE UPDATE OR DELETE ON "FamilyMedicineEditorialEvent"
 FOR EACH ROW EXECUTE FUNCTION family_medicine_editorial_immutable();
CREATE TRIGGER family_medicine_editorial_no_truncate BEFORE TRUNCATE ON "FamilyMedicineEditorialEvent"
 FOR EACH STATEMENT EXECUTE FUNCTION family_medicine_editorial_immutable();

COMMIT;
