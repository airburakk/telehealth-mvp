-- Sağlık Turizmi Faz 2: hasta tercihlerinin (tier/gece/ülke/branş JSON) saklandığı nullable kolon.
-- LOJİSTİK tercih, PHI değil (düz metin). Idempotent (IF NOT EXISTS) — eski şemalı kopyadan/tekrar
-- koşumda failed-kayıt + deploy kilidi üretmez (DEPLOY.md idempotent-SQL kuralı).
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "tourismPlan" TEXT;
