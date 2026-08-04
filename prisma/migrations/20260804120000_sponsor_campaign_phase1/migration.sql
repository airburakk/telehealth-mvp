-- Doctorium monetizasyon Faz 1 (v6.68): sponsorlu kampanya tablosu + doktor kişiselleştirme rızası.
-- İdempotent (IF NOT EXISTS) — yarım kalmış koşu deploy kilidine dönüşmesin (DEPLOY.md Adım 2 kuralı).
-- İLAÇ-DIŞI reklam altyapısı; Modül D (ilaç tanıtımı) parkı sürüyor. Kişi-bazlı gösterim logu YOK.

CREATE TABLE IF NOT EXISTS "SponsorCampaign" (
    "id" TEXT NOT NULL,
    "sponsor" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "targetBranches" TEXT,
    "targetCities" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SponsorCampaign_status_startsAt_endsAt_idx"
    ON "SponsorCampaign"("status", "startsAt", "endsAt");

-- Doktorun sponsorlu içerik kişiselleştirme açık rızası (null = yok/geri alındı → bağlamsal kartlar).
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "sponsorPersonalizationAt" TIMESTAMP(3);
