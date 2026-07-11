-- Registry alan-güncellemesi (v5.4, 2026-07-11): fingerprint'li seçici UPDATE.
-- fingerprint = liste-API alanlarının kısa hash'i; günlük senkronda değişen kayıtlar tespit
-- edilip yalnız onlar güncellenir (14k körlemesine UPDATE yerine günde birkaç kayıt).
-- Rapora güncellenen-kayıt sayaçları eklenir. Tümü additive/nullable-veya-default → migration-önce güvenli.
ALTER TABLE "RegistryDoctor" ADD COLUMN IF NOT EXISTS "fingerprint" TEXT;
ALTER TABLE "RegistryHospital" ADD COLUMN IF NOT EXISTS "fingerprint" TEXT;
ALTER TABLE "RegistryReport" ADD COLUMN IF NOT EXISTS "updatedDoctors" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RegistryReport" ADD COLUMN IF NOT EXISTS "updatedHospitals" INTEGER NOT NULL DEFAULT 0;
