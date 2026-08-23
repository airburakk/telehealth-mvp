-- v6.143 — Tıp/Diş Hekimliği öğrencisi girişi: STUDENT_CERT belge yolu yerine üniversite (.edu.tr)
-- e-postası doğrulaması (kullanıcı kararı 2026-08-23). Eski kapı (herhangi bir STUDENT_CERT
-- yüklemesi = anında erişim, admin reddi bile geri almıyordu) araştırmada bulundu ve tamamen
-- kaldırılıyor — bkz. wiki/kavramlar/doktor-kimlik-dogrulama.md §7 açık kalem.
--
-- Doctor.studentVerifiedAt KOLONU DEĞİŞMİYOR (mevcut, hasDoctoriumAccess formülü aynı) — yalnız
-- onu artık NE damgalıyor değişiyor. Dört YENİ nullable kolon:
--   studentUniversity/studentDepartment — kayıtta beyan edilen üniversite+bölüm (domain eşleşmesi
--     signup anında zaten doğrulanmış olarak buraya düşer).
--   studentVerifyTokenHash/studentVerifySentAt — email-verification.ts'teki User.emailVerify*
--     çiftiyle AYNI desen, ayrı alan: bu güvenlik-kritik öğrenci kapısı genel hesap-doğrulamasının
--     dormant-modda-otomatik-damgalama davranışından İZOLE tutulur.
--
-- NULLABLE, varsayılansız: mevcut satırlar dokunulmadan aynı davranışı görmeye devam eder. Prod'da
-- bugün 0 öğrenci hesabı var (ölçüldü) — backfill/grandfather gerekmiyor.
--
-- Idempotent: aynı migration iki kez koşarsa (Neon dev branch provası + üretim) patlamaz.

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "studentUniversity" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "studentDepartment" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "studentVerifyTokenHash" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "studentVerifySentAt" TIMESTAMP(3);
