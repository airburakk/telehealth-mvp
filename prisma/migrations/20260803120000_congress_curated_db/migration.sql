-- v6.62 — Kongre modülü: küratörlü veritabanı alanları + alarm eşiklerinin ayrışması.
--
-- İDEMPOTENT (proje kuralı): her ifade IF NOT EXISTS / koşullu — yarım kalan bir deploy
-- "already exists" ile kilitlenmesin (failed migration kaydı sonraki deploy'u bloke eder).

-- ── MedicalCongress: küratörlü veri alanları ────────────────────────────────
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'ulusal';
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "edition" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "frequency" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "venue" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "format" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "cmeCredit" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "registrationNotes" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "themes" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "warning" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "sourceUrls" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "confidence" TEXT NOT NULL DEFAULT 'dogrulandi';
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

-- (source, externalId) benzersiz → seed/tazeleme idempotent. Elle girilen kayıtlarda ikisi de
-- NULL kalır; Postgres'te NULL'lar birbiriyle ÇAKIŞMAZ, yani elle giriş sınırlanmaz.
CREATE UNIQUE INDEX IF NOT EXISTS "MedicalCongress_source_externalId_key"
  ON "MedicalCongress" ("source", "externalId");
CREATE INDEX IF NOT EXISTS "MedicalCongress_scope_startDate_idx"
  ON "MedicalCongress" ("scope", "startDate");

-- ── Doctor: son-tarih alarmının İKİYE ayrılması ─────────────────────────────
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "congressAbstractAlertDays" INTEGER;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "congressEarlyBirdAlertDays" INTEGER;

-- GERİYE UYUM: tek eşiği ayarlamış hekimler ayarlarını KAYBETMESİN — eski değer iki yeni alana
-- kopyalanır. Yalnız henüz doldurulmamış satırlar güncellenir (yeniden koşuda üzerine yazmaz).
UPDATE "Doctor"
   SET "congressAbstractAlertDays"  = COALESCE("congressAbstractAlertDays",  "congressDeadlineAlertDays"),
       "congressEarlyBirdAlertDays" = COALESCE("congressEarlyBirdAlertDays", "congressDeadlineAlertDays")
 WHERE "congressDeadlineAlertDays" IS NOT NULL
   AND ("congressAbstractAlertDays" IS NULL OR "congressEarlyBirdAlertDays" IS NULL);
