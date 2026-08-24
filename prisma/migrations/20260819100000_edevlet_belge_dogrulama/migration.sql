-- e-Devlet barkodlu belge doğrulaması + aktivasyon kapısının insan/otomatik onaya bağlanması
-- (v6.119, 2026-08-19). Kullanıcı kararı: "QR'ı sunucuda oku" (B seçeneği) + "doğrulanabilirse
-- otomatik doğrulama olsun". Tasarım: vault wiki/kavramlar/doktor-kimlik-dogrulama.md
--
-- DAVRANIŞ DEĞİŞİKLİĞİ (🔴 SIKILAŞMA — "Ders 1" regresyon sınıfı):
--   ESKİ: DIPLOMA satırı VARSA Doctor.activatedAt damgalanırdı (yükleyen anında klinik yüzeye girer).
--   YENİ: DIPLOMA satırı ACCEPTED ise damgalanır. ACCEPTED iki yoldan gelir:
--         (a) e-Devlet barkod okuması otomatik geçti (lib/edevlet-belge.ts — DIŞ İSTEK YOK)
--         (b) incelemeci /admin/doktor-onay'dan onayladı
--   Sıkılaşma olduğu için MEVCUT AKTİF DOKTORLAR BACKFILL EDİLMEZSE ERİŞİMİNİ KAYBEDER → aşağıdaki
--   UPDATE bu yüzden ZORUNLUDUR, atlanamaz.
--
-- İdempotent (IF NOT EXISTS + koşullu UPDATE): eski şemalı kopyadan yeniden koşulursa güvenli.

-- ── 1) Yeni kolonlar ──────────────────────────────────────────────────────────────────────────
-- verifyCode: belgenin metin katmanından okunan barkod (at-rest şifreli — encryptField).
-- verifiedSource: EDEVLET | MANUAL | LEGACY. verifiedAt: damga zamanı.
ALTER TABLE "DoctorDocument" ADD COLUMN IF NOT EXISTS "verifyCode" TEXT;
ALTER TABLE "DoctorDocument" ADD COLUMN IF NOT EXISTS "verifiedSource" TEXT;
ALTER TABLE "DoctorDocument" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

-- ── 2) BACKFILL (zorunlu) — hâlihazırda AKTİF doktorların diploması ACCEPTED damgalanır ───────
-- 'LEGACY' kaynağı bilinçli olarak 'MANUAL'dan AYRI: bu belgeler gerçekten İNCELENMEDİ, yalnız
-- v6.119 öncesi kuralla aktif oldukları için erişimleri korunuyor. Admin ekranı bunları ayrı
-- rozetle gösterir ki incelemeci "onaylanmış" sanmasın (dürüstlük — sahte güven üretme).
-- Denetim öncesi sayım:
--   SELECT count(*) FROM "DoctorDocument" d JOIN "Doctor" x ON x.id = d."doctorId"
--   WHERE d.type = 'DIPLOMA' AND d.status = 'PENDING' AND x."activatedAt" IS NOT NULL;
UPDATE "DoctorDocument" d
   SET "status" = 'ACCEPTED', "verifiedSource" = 'LEGACY', "verifiedAt" = NOW()
 WHERE d."type" = 'DIPLOMA'
   AND d."status" = 'PENDING'
   AND EXISTS (
     SELECT 1 FROM "Doctor" x WHERE x."id" = d."doctorId" AND x."activatedAt" IS NOT NULL
   );

-- ── 3) Tutarlılık — diploması REDDEDİLMİŞ ama hâlâ aktif görünen doktorların damgası düşürülür ─
-- Bu kayıtlar bugün ZATEN çelişkili: bir incelemeci belgeyi yetersiz bulmuş ama eski kural
-- aktivasyona bakmadığı için erişim açık kalmış. Yeni kural altında kapı kapanmalı. Kapsam dar ve
-- her biri insan kararına dayanır (sürpriz değil — doktora ret bildirimi zaten gitmişti).
-- ⚠️ DIPLOMA satırı HİÇ OLMAYAN aktif doktorlara (seed/demo kayıtları) BİLİNÇLİ DOKUNULMAZ:
--    onlar bu migration'dan önce de canActivate'i geçemiyordu, durumları DEĞİŞMİYOR.
-- Uygulama öncesi sayım:
--   SELECT count(*) FROM "Doctor" x WHERE x."activatedAt" IS NOT NULL AND EXISTS (
--     SELECT 1 FROM "DoctorDocument" d WHERE d."doctorId" = x.id AND d.type='DIPLOMA' AND d.status='REJECTED');
UPDATE "Doctor" x
   SET "activatedAt" = NULL
 WHERE x."activatedAt" IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM "DoctorDocument" d
      WHERE d."doctorId" = x."id" AND d."type" = 'DIPLOMA' AND d."status" = 'REJECTED'
   );
