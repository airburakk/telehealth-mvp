-- Kariyer EDU E2 (2026-09-06): staj/değişim/burs fırsat kaydı + öğrenci takibi. Yalnız EKLEME (IF NOT EXISTS — yeniden koşum güvenli).
-- Fırsat = SÜREÇ BİLGİSİ (ilan değil); approvedAt NULL iken hiçbir yüzeyde görünmez (👤 kapısı).
CREATE TABLE IF NOT EXISTS "EduOpportunity" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "country" TEXT,
    "deadline" TIMESTAMP(3),
    "deadlineNote" TEXT,
    "startsAt" TEXT,
    "eligibility" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EduOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EduOpportunity_approvedAt_deadline_idx" ON "EduOpportunity"("approvedAt", "deadline");

-- Takip — CongressFollow aynası (ilişkisiz düz id'ler; unique çift). sentAlerts JSON string[] ("7" | "3" | "1").
CREATE TABLE IF NOT EXISTS "EduOpportunityFollow" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "sentAlerts" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EduOpportunityFollow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EduOpportunityFollow_doctorId_opportunityId_key" ON "EduOpportunityFollow"("doctorId", "opportunityId");
CREATE INDEX IF NOT EXISTS "EduOpportunityFollow_opportunityId_idx" ON "EduOpportunityFollow"("opportunityId");
