-- Doctorium "Kaydettiklerim" (Faz 2, 2026-08-14): SavedArticle — CongressFollow deseninin
-- kopyası (ilişkisiz düz id'ler + unique çift). Idempotent: IF NOT EXISTS (proje kuralı —
-- eski şemalı kopyadan yeniden koşulsa bile güvenli).

CREATE TABLE IF NOT EXISTS "SavedArticle" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SavedArticle_doctorId_articleId_key"
    ON "SavedArticle"("doctorId", "articleId");

CREATE INDEX IF NOT EXISTS "SavedArticle_doctorId_createdAt_idx"
    ON "SavedArticle"("doctorId", "createdAt");
