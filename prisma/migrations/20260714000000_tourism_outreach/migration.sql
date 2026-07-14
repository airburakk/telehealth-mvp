-- Sağlık turizmi ilk-temas katmanı (2026-07-14): TourismOutreach
-- Branş havuzundaki doktor → tourism-Case'e tanıtım mesajı + opsiyonel video randevu teklifi.
-- ÇOKLU doktor aynı vakaya outreach yapabilir (caseId UNIQUE DEĞİL). İdempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "TourismOutreach" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "consultationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TourismOutreach_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TourismOutreach_caseId_idx" ON "TourismOutreach"("caseId");
CREATE INDEX IF NOT EXISTS "TourismOutreach_doctorId_status_idx" ON "TourismOutreach"("doctorId", "status");
