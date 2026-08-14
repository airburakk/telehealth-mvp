-- Doktor belge inceleme akışı — Faz 2 (2026-08-14).
-- Tasarım + kullanıcı kararları: vault output/doktor-belge-kontrol-tasarimi-2026-08-14.md
--   · DoctorDocument.status — PENDING/ACCEPTED/REJECTED inceleme kararı (mevcut satırlar PENDING
--     başlar; onay zaten Doctor.verified'da yaşadığı için geriye dönük damgalama GEREKMEZ).
--     Karar aktivasyona DOKUNMAZ — yalnız görünürlük + doktora gerekçeli bildirim.
--   · DoctorDocument.reviewNote — REJECTED gerekçesi (doktora bildirimle gider).
-- NOT: Faz 1b'nin Doctor.mmssValidUntil alanı AYRICA GEREKMEDİ — kolon 20260703 baseline'dan,
--   şema alanı + /api/doctor/mmss yazımı HEAD'den beri mevcuttu (bu iş yalnız hekim-onay
--   ekranında ROZET görünürlüğü ekledi; form alanı v6.95 kapanışı sonrası ayrı iş).
-- İdempotent (IF NOT EXISTS): eski şemalı kopyadan yeniden koşulursa güvenli.

ALTER TABLE "DoctorDocument" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "DoctorDocument" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;
