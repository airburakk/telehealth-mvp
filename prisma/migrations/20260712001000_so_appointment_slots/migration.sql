-- Basitleştirme Faz 3 (2026-07-12): SO video randevusunda çok-slot teklifi — doktor 2-3 alternatif
-- zaman önerir (ISO dizisi), hasta tek tıkla birini seçer (el sıkışması 2-3 tur → 1 tur).
-- null = tek-zaman teklifi (mevcut davranış, geriye uyumlu). Additive/nullable (idempotent).
ALTER TABLE "SecondOpinionAppointment" ADD COLUMN IF NOT EXISTS "proposedSlots" JSONB;
