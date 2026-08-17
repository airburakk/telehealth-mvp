-- v6.105 (kullanıcı kararı 2026-08-17): İkinci Görüş + Sağlık Turizmi panelleri TERCİHE bağlandı.
-- Önceki davranış: so = ünvanla (Doç./Prof.) OTOMATİK açık · tourism = her doktorda KOŞULSUZ açık.
-- Yeni davranış:   so = soEligible(title) && soOptIn · tourism = tourismOptIn.
--
-- ⚠️ REGRESYON KORUMASI (m5-doctor-signup "Ders 1" — kapı sıkılaştırırken mevcut kayıtları düşürme):
-- Kolonlar DEFAULT false ile eklenir (yeni doktor bilinçli seçsin) ama MEVCUT TÜM satırlar true
-- damgalanır. Aksi hâlde bu migration, hâlihazırda sağlık turizmi havuzunda çalışan her doktoru ve
-- ünvanı uygun her İkinci Görüş doktorunu tek seferde panelsiz bırakırdı.
-- soOptIn'i ünvana bakmadan herkese true vermek GÜVENLİDİR: ünvan kapısı kodda AYRICA aranır
-- (soEligible && soOptIn), yani ünvanı olmayanda bu damga hiçbir kapı açmaz.
--
-- Idempotent (IF NOT EXISTS): kısmen uygulanmış ortamda yeniden koşturulabilir.
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "soOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "tourismOptIn" BOOLEAN NOT NULL DEFAULT false;

-- Mevcut doktorları koru. Yalnız BU migration'ın eklediği varsayılanı taşıyan satırlar hedeflenir;
-- migration'dan sonra açılan hesaplar (henüz yok) etkilenmez.
UPDATE "Doctor" SET "soOptIn" = true, "tourismOptIn" = true;
