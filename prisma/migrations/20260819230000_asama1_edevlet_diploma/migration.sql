-- Aşama 1 yeniden tasarımı: Doctorium kapısı = e-Devlet doğrulamalı DİPLOMA (v6.124, 2026-08-19).
-- Kullanıcı kararı ("Yalnız e-Devlet diploma"): tabip odası yazısı (CHAMBER/chamberLetterAt) artık
-- Doctorium AÇMAZ — kolon tarihsel kayıt olarak kalır, kapı kodda okumayı bırakır
-- (lib/doctor-activation.ts hasDoctoriumAccess). Tasarım: vault doktor-kimlik-dogrulama.md §8.
--
-- Grandfather/kurtarma katmanı BİLİNÇLİ YOK: prod'da gerçek doktor bulunmuyor ve lansmanda tüm
-- kayıtlar sıfırlanacak (kullanıcı teyidi 2026-08-19) — yalnız-CHAMBER'lı test hesapları Doctorium
-- erişimini kaybeder, bu kabul edilmiş sonuçtur.
--
-- İdempotent (IF NOT EXISTS + koşullu UPDATE): eski şemalı kopyadan yeniden koşulursa güvenli.

-- 1) Aşama 1 damgası: DIPLOMA belgesi ACCEPTED olan doktor.
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "diplomaVerifiedAt" TIMESTAMP(3);

-- 2) Backfill: ACCEPTED diploması olan herkese damga (v6.122'nin LEGACY/EDEVLET/MANUAL kabulleri
--    dahil — activatedAt'li doktorların diploması v6.122 migration'ında zaten ACCEPTED yapılmıştı,
--    dolayısıyla bugün aktif hiçbir doktor Doctorium erişimini kaybetmez).
UPDATE "Doctor" x
   SET "diplomaVerifiedAt" = NOW()
 WHERE x."diplomaVerifiedAt" IS NULL
   AND EXISTS (
     SELECT 1 FROM "DoctorDocument" d
      WHERE d."doctorId" = x."id" AND d."type" = 'DIPLOMA' AND d."status" = 'ACCEPTED'
   );
