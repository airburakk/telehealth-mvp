-- v6.351 (2026-10-17): Sosyal medya günlük ölçüleri — n8n günlük hesap toplamlarını /api/social-metrics ile iter, /admin/pano okur.
-- Kişisel veri YOK (yalnız sayısal hesap toplamları). Yeni TABLO → migration-önce (DEPLOY.md Adım 2): üretimde kod birleşmeden ÖNCE uygulanır.
-- Idempotent (DEPLOY.md Adım 2): yarıda düşen deploy yeniden koşulabilir.
CREATE TABLE IF NOT EXISTS "SocialMetricDaily" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "followers" INTEGER,
    "reach" INTEGER,
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "saves" INTEGER,
    "shares" INTEGER,
    "profileClicks" INTEGER,
    "posts" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialMetricDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialMetricDaily_platform_day_key" ON "SocialMetricDaily"("platform", "day");

CREATE INDEX IF NOT EXISTS "SocialMetricDaily_day_idx" ON "SocialMetricDaily"("day");
