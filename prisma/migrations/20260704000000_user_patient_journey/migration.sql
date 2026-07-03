-- Hasta yolculuğu tercihi: /basla seçim ekranında yazılır, Header nav'ını belirler.
-- Değerler: GENERAL | SECOND_OPINION | FREE_CARE; NULL = henüz seçmedi (GENERAL nav varsayılır).
-- Idempotent: eski şemalı kopyadan koşulsa da failed-kayıt/deploy kilidi üretmez.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patientJourney" TEXT;
