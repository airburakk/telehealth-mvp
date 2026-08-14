-- Tıp öğrencisi hunisi — yol işareti (v6.95, 2026-08-14)
-- /ogrenci hunisinden açılan hesap studentTrack=true doğar: belge yüklenmeden ÖNCE de
--   onboarding öğrenci modunda kalır (klinik belge/MMSS blokları hiç gösterilmez) ve
--   HealthTürkiye dizin doğrulaması atlanır (öğrenci dizinde olmaz).
-- Erişim AÇMAZ: Doctorium kapısı daima damgalara bakar (studentVerifiedAt/chamberLetterAt/
--   activatedAt — 20260814150000_student_membership). Mevcut doktorlar default(false) ile
--   etkilenmez → veri taşıma YOK.
-- İdempotent: eski şemalı kopyadan tekrar koşulursa hata vermez (IF NOT EXISTS).
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "studentTrack" BOOLEAN NOT NULL DEFAULT false;
