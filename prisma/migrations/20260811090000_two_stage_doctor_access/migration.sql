-- İki aşamalı doktor girişi (v6.87, 2026-08-11)
-- Aşama 1: tabip odası "Protokol Numaralı" üye yazısı (DoctorDocument.type = CHAMBER, kolon
--   değişikliği gerektirmez — type serbest String) → Doctor.chamberLetterAt damgalanır → yalnız
--   Doctorium erişimi. Otomatik açılır, admin onayı beklemez (kullanıcı kararı 2026-08-11).
-- Aşama 2: mevcut klinik aktivasyon (diploma + MMSS + işlem + qualification → activatedAt) DEĞİŞMEDİ.
-- Kapı kuralı kodda: chamberLetterAt VEYA activatedAt → Doctorium (hasDoctoriumAccess);
--   mevcut aktif doktorlar bu OR sayesinde backfill'siz geçer → veri taşıma YOK.
-- İdempotent: eski şemalı kopyadan tekrar koşulursa hata vermez (IF NOT EXISTS).
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "chamberLetterAt" TIMESTAMP(3);

-- İK iletişim izni (opt-in damga; hizmete şart değil). İspat zinciri ConsentRecord'da
-- (scope HR_CONTACT / HR_CONTACT_REVOKE) — o tablo scope-bazlı olduğundan kolon istemez.
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "hrContactOptInAt" TIMESTAMP(3);
