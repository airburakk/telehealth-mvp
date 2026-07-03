-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "verified" SET DEFAULT false,
ALTER COLUMN "rating" DROP NOT NULL,
ALTER COLUMN "rating" DROP DEFAULT,
ALTER COLUMN "successRate" DROP NOT NULL,
ALTER COLUMN "successRate" DROP DEFAULT,
ALTER COLUMN "experienceYears" DROP NOT NULL,
ALTER COLUMN "experienceYears" DROP DEFAULT,
ALTER COLUMN "jci" DROP NOT NULL,
ALTER COLUMN "jci" DROP DEFAULT;

-- Veri dürüstlüğü temizliği: ESKİ default'lardan doğmuş (fabrikasyon) self-signup satırlarını null'a çek.
-- Parmak izi: seed formülü successRate'te asla 95 üretmez (yalnız 90/93/96) + seed hep bio yazar →
-- successRate=95 AND bio IS NULL = default'a düşmüş gerçek kayıt. Demo (seed) satırları ETKİLENMEZ.
-- Kod-önce-push penceresinde doğan kayıtları da yakalar. İdempotent (ikinci koşuda 0 satır).
UPDATE "Doctor"
SET "rating" = NULL, "successRate" = NULL, "experienceYears" = NULL, "jci" = NULL
WHERE "verified" = false AND "bio" IS NULL AND "successRate" = 95;

