-- DropIndex
DROP INDEX IF EXISTS "ConsentRecord_userId_idx";

-- DropIndex
DROP INDEX IF EXISTS "ConsultationMessage_requestId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Signal_consultationId_idx";

-- DropIndex
DROP INDEX IF EXISTS "SecondOpinionCase_status_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_doctorId_idx" ON "User"("doctorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_partnerId_idx" ON "User"("partnerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Review_doctorId_createdAt_idx" ON "Review"("doctorId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Case_doctorId_idx" ON "Case"("doctorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Case_branch_status_idx" ON "Case"("branch", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConsultationRequest_answeredByDoctorId_idx" ON "ConsultationRequest"("answeredByDoctorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConsultationMessage_requestId_createdAt_idx" ON "ConsultationMessage"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Consultation_doctorId_status_idx" ON "Consultation"("doctorId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Consultation_caseId_idx" ON "Consultation"("caseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_caseId_createdAt_idx" ON "Booking"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CheckIn_recoveryId_createdAt_idx" ON "CheckIn"("recoveryId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Signal_consultationId_id_idx" ON "Signal"("consultationId", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SecondOpinionCase_status_branch_idx" ON "SecondOpinionCase"("status", "branch");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccessLog_createdAt_id_idx" ON "AccessLog"("createdAt", "id");

