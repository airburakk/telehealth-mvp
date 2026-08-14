-- Doctorium Akış Tercihleri (Faz 2, 2026-08-14): Doctor.feedModules — Akışım'a hangi bölümler
-- girsin (JSON string[]; null/boş = tümü). Idempotent (proje kuralı).

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "feedModules" TEXT;
