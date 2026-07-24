-- Belge-bekleyen basvuru (2026-07-24): Case.pendingDocs — bekleyen zorunlu belge etiketleri (JSON dizi).
-- Idempotent (failed kayit = deploy kilidi kurali).
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "pendingDocs" TEXT;

-- Onceki migration driftinin temizligi: TourismOutreach.updatedAt DB-default tasimasin
-- (@updatedAt client-side yonetilir). DROP DEFAULT kolonda default yoksa no-op.
ALTER TABLE "TourismOutreach" ALTER COLUMN "updatedAt" DROP DEFAULT;
