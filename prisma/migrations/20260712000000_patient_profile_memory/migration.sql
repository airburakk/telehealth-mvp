-- Profil hafızası (hasta akışı basitleştirme Faz 0, 2026-07-12) — additive/nullable kolonlar (idempotent).
-- "Bir kez sor, her yerde kullan": intake'te girilen ülke/dil/telefon/iletişim tercihi User'a
-- yaz-geri edilir; sonraki intake'ler prefill eder. patientPhone uygulama katmanında ŞİFRELİ yazılır.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patientCountry" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patientLanguage" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patientPhone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patientContactPref" TEXT;
