-- v6.328 (2026-10-06): İçerik takvimi — sosyal medya rubrik yuvaları (rubrik × Türkiye günü); kaynak seçimi → slayt taslağı → insan onayı → yayın izi (lib/social-calendar).
-- İçerik PHI DEĞİL (kamuya açık anonim karar/etkinlik metadata'sı + editör metni). Yeni TABLO → migration-önce (DEPLOY.md Adım 2): üretimde kod birleşmeden ÖNCE uygulanır.
-- Idempotent (DEPLOY.md Adım 2): yarıda düşen deploy yeniden koşulabilir.
CREATE TABLE IF NOT EXISTS "ContentPlanItem" (
    "id" TEXT NOT NULL,
    "seriesKey" TEXT NOT NULL,
    "slotDay" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "sourceKind" TEXT,
    "sourceIds" TEXT NOT NULL DEFAULT '[]',
    "candidates" TEXT NOT NULL DEFAULT '[]',
    "payload" TEXT,
    "attestIdentity" BOOLEAN NOT NULL DEFAULT false,
    "gateReport" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedBy" TEXT,
    "approvedHash" TEXT,
    "publishedRefs" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContentPlanItem_seriesKey_slotDay_key" ON "ContentPlanItem"("seriesKey", "slotDay");

CREATE INDEX IF NOT EXISTS "ContentPlanItem_slotDay_idx" ON "ContentPlanItem"("slotDay");

CREATE INDEX IF NOT EXISTS "ContentPlanItem_status_slotDay_idx" ON "ContentPlanItem"("status", "slotDay");
