-- Doktor profil tanıtım videosu (2026-08-14): YouTube/Vimeo URL'i ya da public Blob URL'i.
-- İdempotent: eski şemalı kopyadan tekrar koşulursa hata vermez.
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "introVideo" TEXT;
