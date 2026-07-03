-- Rename Aşama B (Pro Bono → Ücretsiz Sağlık Hizmeti): DB kolonları Prisma alan adlarıyla hizalanır.
-- ⚠️ KOORDİNELİ DEPLOY: bu migration @map'siz kodla BİRLİKTE gider (eski kod+yeni kolon VE
-- yeni kod+eski kolon ikisi de kırılır; pencere saniyeler — runbook: DEPLOY.md).
-- Idempotent: DO-blokları kolon zaten yeniden adlanmışsa/eski şemalı kopyada koşulursa no-op.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Case' AND column_name='proBono')
    THEN ALTER TABLE "Case" RENAME COLUMN "proBono" TO "freeCare"; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Case' AND column_name='proBonoStatus')
    THEN ALTER TABLE "Case" RENAME COLUMN "proBonoStatus" TO "freeCareStatus"; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Doctor' AND column_name='proBonoOptIn')
    THEN ALTER TABLE "Doctor" RENAME COLUMN "proBonoOptIn" TO "freeCareOptIn"; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Doctor' AND column_name='proBonoState')
    THEN ALTER TABLE "Doctor" RENAME COLUMN "proBonoState" TO "freeCareState"; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Doctor' AND column_name='proBonoQuota')
    THEN ALTER TABLE "Doctor" RENAME COLUMN "proBonoQuota" TO "freeCareQuota"; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Doctor' AND column_name='proBonoUsed')
    THEN ALTER TABLE "Doctor" RENAME COLUMN "proBonoUsed" TO "freeCareUsed"; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Doctor' AND column_name='proBonoResetAt')
    THEN ALTER TABLE "Doctor" RENAME COLUMN "proBonoResetAt" TO "freeCareResetAt"; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Doctor' AND column_name='proBonoAvailableAt')
    THEN ALTER TABLE "Doctor" RENAME COLUMN "proBonoAvailableAt" TO "freeCareAvailableAt"; END IF;
END $$;

ALTER INDEX IF EXISTS "Case_proBono_proBonoStatus_idx" RENAME TO "Case_freeCare_freeCareStatus_idx";

-- Bildirim tip VERİSİ: eski satırlar yeni tip adına taşınır (kod yalnız FREECARE_* yazar; doğal idempotent).
UPDATE "Notification" SET "type"='FREECARE_MATCH'     WHERE "type"='PROBONO_MATCH';
UPDATE "Notification" SET "type"='FREECARE_TREATMENT' WHERE "type"='PROBONO_TREATMENT';
