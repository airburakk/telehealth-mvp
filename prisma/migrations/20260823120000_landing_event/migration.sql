-- Doctorium landing V2 analytics — GÜNLÜK AGREGAT sayaç tablosu (2026-08-23, DOCV2-010).
-- Satır = (olay adı, yer, gün) + sayı. Kimlik/çerez/IP/UA/URL/tercih YOK — kişisel veri değil.
-- Yeni tablo = "migration-önce" sınıfı (DEPLOY.md Adım 2): kod bu tabloyu okumadan önce prod'a
-- uygulanır; pre-push kancası bekleyen migration'da push'u durdurur.
-- İdempotent (IF NOT EXISTS): eski şemalı kopyadan yeniden koşulursa güvenli.

CREATE TABLE IF NOT EXISTS "LandingEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LandingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LandingEvent_name_placement_day_key" ON "LandingEvent"("name", "placement", "day");
CREATE INDEX IF NOT EXISTS "LandingEvent_day_idx" ON "LandingEvent"("day");
