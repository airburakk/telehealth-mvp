-- Doctorium Post (2026-08-24) — günlük özet ("sabah gazetesi") aboneliği + baskı kaydı.
--
-- Doctor.digestChannel: null = kapalı (VARSAYILAN — abonelik açık seçimdir, ⚖️ ETK/İYS
-- değerlendirmesi bu opt-in'e dayanır) · "app" = uygulama içi · "email" = e-posta + uygulama içi.
-- Mevcut satırlar null kalır → hiçbir doktor kendiliğinden abone OLMAZ.
--
-- DailyDigest: doktor+gün başına tek baskı (unique) — cron yeniden koşarsa ikinci baskı
-- üretilmez; itemsJson anlık görüntü (e-posta ↔ web aynı baskıyı gösterir; arşiv bedava).
--
-- Idempotent: aynı migration iki kez koşarsa (Neon dev branch provası + üretim) patlamaz.

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "digestChannel" TEXT;

CREATE TABLE IF NOT EXISTS "DailyDigest" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyDigest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyDigest_doctorId_day_key" ON "DailyDigest"("doctorId", "day");
CREATE INDEX IF NOT EXISTS "DailyDigest_doctorId_createdAt_idx" ON "DailyDigest"("doctorId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DailyDigest_doctorId_fkey'
    ) THEN
        ALTER TABLE "DailyDigest" ADD CONSTRAINT "DailyDigest_doctorId_fkey"
            FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
