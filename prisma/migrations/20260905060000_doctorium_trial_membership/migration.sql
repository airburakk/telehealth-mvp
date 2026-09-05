-- v6.234 (2026-09-05) — Doctorium ÜÇ KATMANLI ÜYELİK (deneme · doğrulanmış · öğrenci), Faz A2 — kullanıcı kararı
-- 2026-09-05; plan .claude/plans/frolicking-knitting-globe.md. Yalnız NULLABLE kolon + index ekler; backfill YOK
-- (NULL = "deneme yolu değil / bağlantı yok" doğru durumdur; mevcut doğrulanmamış hesaplara pencere VERİLMEZ).
--
-- SIRA (migration-ÖNCE — hafıza prisma-migrate-first): bu migration ÜRETİME uygulanır, SONRA bu kolonları okuyan/yazan
-- kod (Faz A3: parolasız giriş bağlantısı · deneme damgası · Header geri sayımı · kilit; Faz A4: trial-sweep cron)
-- deploy edilir. Ters sıra eski şemada yeni client'ın SELECT'ini kırar. Uygulama: node scripts/apply-prod-migration.mjs
-- (PROD_DATABASE_URL, ayrı kullanıcı onayı).
--
-- Doctor.trialStartedAt / trialEndsAt : deneme penceresi (TRIAL_DAYS=30, lib/doctorium-tiers.ts) — ikisi birlikte dolar.
-- Doctor.trialAlertsSent               : gönderilen uyarılar JSON string[] ("7"|"3"|"1"|"ended"|"purge-notice").
-- User.loginTokenHash / loginTokenSentAt: parolasız giriş bağlantısı (sha256 + TTL tabanı; ayrı kolon kuralı).

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginTokenSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "trialAlertsSent" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Doctor_trialEndsAt_idx" ON "Doctor"("trialEndsAt");
