-- Kurumsal üyelik başvuruları (2026-08-12): User.staffVerifiedAt + StaffApplication + StaffDocument.
-- PARTNER/AGENCY/HEALTH_PRO self-signup → insan onayı (personel-onay) → staffVerifiedAt damgası.
-- İdempotent (IF NOT EXISTS): eski şemalı kopyadan tekrar koşulsa da güvenli.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "staffVerifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "StaffApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StaffApplication_userId_key" ON "StaffApplication"("userId");
CREATE INDEX IF NOT EXISTS "StaffApplication_status_createdAt_idx" ON "StaffApplication"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "StaffDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StaffDocument_applicationId_idx" ON "StaffDocument"("applicationId");

-- Mevcut personel hesapları doğrulanmış damgalanır (seed/demo hesapları dahil) — yeni kapı eski
-- hesapları kilitlemesin. PATIENT/DOCTOR kapsam dışı (hasta kapısız; doktorun kendi damgaları var).
UPDATE "User" SET "staffVerifiedAt" = CURRENT_TIMESTAMP
WHERE "role" IN ('COORDINATOR','ETHICS','AGENCY','PARTNER','ADMIN') AND "staffVerifiedAt" IS NULL;
