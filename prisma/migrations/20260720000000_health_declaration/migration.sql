-- Sağlık beyanı / sigorta risk formu (2026-07-20) — additive/nullable kolonlar (idempotent).
-- Hasta paket ekranında sağlık beyanı verir → prim endikatif risk çarpanıyla kişiselleşir.
-- healthDeclaration + patientHealthHistory uygulama katmanında ŞİFRELİ yazılır (özel nitelikli veri).
-- Case: vaka anına sabit beyan (denetlenebilirlik) · User: profil hafızası kopyası (sonraki vakada prefill).
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "healthDeclaration" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "healthDeclaredAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patientHealthHistory" TEXT;
