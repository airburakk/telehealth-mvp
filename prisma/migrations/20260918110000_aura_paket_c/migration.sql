-- AURA hukuki set kod Paket C (2026-09-18) — A06 Saklama ve İmha Politikası madde 3.1b (👤 S5, 12.09.2026):
-- hiç başvuru açmamış / giriş yapılmayan hasta veya personel hesabı son aktiviteden 3 yıl sonra, silmeden 30 gün
-- önce bildirimle silinir. Doctorium 05 madde 3.1b'nin (Doctor.lastLoginAt, 20260909120000_kvkk_paket2) User eşleniği;
-- iki süpürme aynı saf karar fonksiyonunu paylaşır (lib/abandoned-sweep abandonedActionFor).
--
-- SIRA (migration-ÖNCE — hafıza prisma-migrate-first): bu migration ÜRETİME uygulanır, SONRA bu kolonları okuyan/yazan
-- kod (lib/login-activity.ts · lib/aura-abandoned-sweep.ts · lib/account-deletion.ts) deploy edilir. Prisma client
-- User'a dokunan HER sorguda tüm skalarları enumerate eder → ters sıra site geneli P2022 verir (v6.132 dersi).
--
-- User.lastLoginAt           : recordLogin damgalar (4 giriş yolu tek nokta). NULL = kolon açıldığından beri giriş yok
--                              (süpürme createdAt'i taban alır).
-- User.abandonedNoticeSentAt : "hesabınız 30 gün içinde silinecek" bildiriminin gönderildiği an (Doctor eşleniği);
--                              giriş yapılınca NULL'lanır (bildirim, yeni bir pasiflik döneminde yeniden gönderilir).
--
-- Geri doldurma: AccessLog LOGIN satırları (lib/login-activity, v6.187'den beri) — kolonun açılışından ÖNCEKİ girişler
-- kaybolmasın; hiç LOGIN satırı olmayan hesap NULL kalır. İdempotent (IF NOT EXISTS + yalnız NULL satırlar).

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "abandonedNoticeSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_lastLoginAt_idx" ON "User"("lastLoginAt");

-- Backfill (AccessLog LOGIN → User.lastLoginAt; yalnız boş olanlar)
UPDATE "User" u
SET "lastLoginAt" = s."lastLogin"
FROM (
  SELECT "actorId", MAX("createdAt") AS "lastLogin"
  FROM "AccessLog"
  WHERE "action" = 'LOGIN' AND "actorId" IS NOT NULL
  GROUP BY "actorId"
) s
WHERE u."id" = s."actorId" AND u."lastLoginAt" IS NULL;
