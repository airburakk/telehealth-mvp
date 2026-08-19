-- AŞAMA 2 güvenlik katmanları (v6.126, 2026-08-19) — Doximity uyarlaması, vault
-- doktor-kimlik-dogrulama.md §8.2. Kullanıcı kararları: SMS OTP zorunlu + [iş e-postası ∨ klinik
-- telefonu geri-arama] (biri yeterli); diploma Aşama 2'de TEKRAR İSTENMEZ (Aşama 1'den taşınır).
-- Kapı şartı YALNIZ AURA_LAYER_GATE=1 iken uygulanır (dormant) → bu migration davranış DEĞİŞTİRMEZ,
-- yalnız zemin döşer; backfill GEREKMEZ (kolonlar null başlar, gate kapalıyken okunmaz).
-- İdempotent (IF NOT EXISTS): eski şemalı kopyadan yeniden koşulursa güvenli.

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "smsVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "workEmail" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "workEmailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "clinicPhoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "clinicPhoneEstablishment" TEXT;

CREATE TABLE IF NOT EXISTS "VerificationChallenge" (
  "id"         TEXT NOT NULL,
  "doctorId"   TEXT NOT NULL,
  "channel"    TEXT NOT NULL,
  "target"     TEXT NOT NULL,
  "codeHash"   TEXT NOT NULL,
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VerificationChallenge_doctorId_channel_idx"
  ON "VerificationChallenge"("doctorId", "channel");
