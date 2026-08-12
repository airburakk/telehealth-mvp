-- Anket ödül puanları + ödül kataloğu/talep katmanı (v6.88, 2026-08-11)
-- Puan LEDGER'ı: bakiye kolonu YOK — bakiye = SUM(PointEntry.delta) (tek gerçek kaynak; satır
--   silinmez/güncellenmez, her hareket ayrı iz). Nakit honorarium alanı ve kilidi AYNEN durur.
-- Katalog BOŞ başlar: veri taşıma YOK; ilk kalem girişi kullanıcı (hukuki değerlendirme) sonrası.
-- İdempotent (IF NOT EXISTS / koşullu FK) — DEPLOY.md Adım 2 kuralı.

ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PointEntry" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "surveyId" TEXT,
    "redemptionId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEntry_pkey" PRIMARY KEY ("id")
);

-- NULL surveyId satırları (harcama/iade) Postgres'te unique'e takılmaz — yalnız SURVEY kazançları teklenir.
CREATE UNIQUE INDEX IF NOT EXISTS "PointEntry_doctorId_surveyId_key" ON "PointEntry"("doctorId", "surveyId");
CREATE INDEX IF NOT EXISTS "PointEntry_doctorId_createdAt_idx" ON "PointEntry"("doctorId", "createdAt");

CREATE TABLE IF NOT EXISTS "RewardItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RewardItem_active_createdAt_idx" ON "RewardItem"("active", "createdAt");

CREATE TABLE IF NOT EXISTS "RewardRedemption" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RewardRedemption_status_createdAt_idx" ON "RewardRedemption"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "RewardRedemption_doctorId_createdAt_idx" ON "RewardRedemption"("doctorId", "createdAt");

-- FK: RewardRedemption.itemId → RewardItem.id (Prisma varsayılanı: RESTRICT/CASCADE).
-- Talebi olan katalog kalemi silinemez (RESTRICT) — ledger izi kopmaz; kalem "active=false" ile emekli edilir.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RewardRedemption_itemId_fkey') THEN
    ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "RewardItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
