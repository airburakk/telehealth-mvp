-- E-posta doğrulama (Auth Faz 5, v5.6) — additive/nullable kolonlar (idempotent).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifySentAt" TIMESTAMP(3);

-- Mevcut hesaplar (demo hesaplar dahil) doğrulama zorunluluğundan MUAF: migration anında
-- doğrulanmış damgalanır. Yalnız bundan sonraki e-posta kayıtları null başlar ve doğrulama ister.
UPDATE "User" SET "emailVerifiedAt" = NOW() WHERE "emailVerifiedAt" IS NULL;
