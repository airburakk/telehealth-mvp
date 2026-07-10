-- RegistryHospital.authorizationNumber — sağlık turizmi YETKİ BELGE NO (v5.2, 2026-07-10).
-- Detay zenginleştirmesinden dolar ("" = kontrol edildi/belge yok, null = henüz bakılmadı).
-- Nullable + additive → migration-önce güvenli (eski kod kolonu enumerate etmez).
ALTER TABLE "RegistryHospital" ADD COLUMN IF NOT EXISTS "authorizationNumber" TEXT;
