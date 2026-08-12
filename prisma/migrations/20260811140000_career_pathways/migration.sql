-- Doctorium "Kariyer" modülü — hekim kariyer & denklik rehberi (v6.89, 2026-08-11)
--
-- Küratörlü veritabanı (MedicalCongress deseni): resmî otorite siteleri makine erişimine kapalı
-- olduğu için veri elle derlenir (kaynak belgesi: vault output/kariyer-denklik-veritabani-2026-08-11.md,
-- seed: prisma/seed-data/career-pathways.json + scripts/seed-career-pathways.ts).
--
-- İŞ İLANI TABLOSU DEĞİLDİR: başvuru/aracılık alanı yoktur (İŞKUR izni Faz 3 — envanter §3).
-- İdempotent: eski şemalı kopyadan tekrar koşulursa hata vermez (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "CareerPathway" (
    "id"            TEXT NOT NULL,
    "slug"          TEXT NOT NULL,
    "scope"         TEXT NOT NULL,
    "country"       TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "authority"     TEXT NOT NULL,
    "summary"       TEXT NOT NULL,
    "steps"         TEXT NOT NULL DEFAULT '[]',
    "documents"     TEXT NOT NULL DEFAULT '[]',
    "languageReq"   TEXT,
    "examReq"       TEXT,
    "typicalMonths" TEXT,
    "costNote"      TEXT,
    "officialUrl"   TEXT NOT NULL,
    "sourceUrls"    TEXT NOT NULL DEFAULT '[]',
    "confidence"    TEXT NOT NULL DEFAULT 'dogrulandi',
    "verifiedAt"    TIMESTAMP(3) NOT NULL,
    "warning"       TEXT,
    "order"         INTEGER NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerPathway_pkey" PRIMARY KEY ("id")
);

-- slug: URL segmenti + seed idempotansının dayanağı
CREATE UNIQUE INDEX IF NOT EXISTS "CareerPathway_slug_key" ON "CareerPathway"("slug");

-- Alt-sekme listesi (yurtdisi | turkiye) sıralı okur
CREATE INDEX IF NOT EXISTS "CareerPathway_scope_order_idx" ON "CareerPathway"("scope", "order");
