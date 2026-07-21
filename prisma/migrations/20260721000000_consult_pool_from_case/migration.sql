-- İç vakadan havuza konsültasyon (v6.33 Faz 3) — additive/nullable kolon (idempotent).
-- Talebi iç vakadan açan platform doktoru: kendi talebi havuz listesinde gösterilmez (kendi
-- vakasına kendisi görüş vermesin); yanıt bildirimi + Havuz Görüşü kartı vaka sayfasına düşer.
ALTER TABLE "ConsultationRequest" ADD COLUMN IF NOT EXISTS "requestedByDoctorId" TEXT;
