-- Hesap ve veri silme (v6.11) — KVKK m.7 / GDPR m.17 iki katmanlı model.
--   User.deletedAt              : hesap silindi (kişisel alanlar boşaltıldı, giriş imkânsız; kabuk
--                                 ConsentRecord bağı için saklama süresi boyunca durur)
--   Case/SecondOpinionCase
--     .deletionLockedAt         : klinik kayıt HERKESE kapalı (ownership kilidi rol kontrolünden ÖNCE)
--     .purgeAfter               : yasal saklama süresi sonu → cron fiziken imha eder
--
-- GERİYE UYUMLU (kod-öncesi güvenli): hepsi NULLABLE + varsayılan NULL → mevcut satırlar etkilenmez;
-- deletionLockedAt IS NULL = kilit yok = bugünkü davranış. Bu migration önce uygulanabilir, eski kod
-- kolonları yok sayar; yeni kod geldiğinde kolonlar hazır olur ([[prisma-migrate-first]]: yeni kolon =
-- migration-ÖNCE).
--
-- IDEMPOTENT: her ifade IF NOT EXISTS — yarım/tekrarlı uygulama deploy'u kilitlemesin (başarısız
-- migration kaydı `migrate deploy`'u durdurur).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "deletionLockedAt" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "purgeAfter" TIMESTAMP(3);

ALTER TABLE "SecondOpinionCase" ADD COLUMN IF NOT EXISTS "deletionLockedAt" TIMESTAMP(3);
ALTER TABLE "SecondOpinionCase" ADD COLUMN IF NOT EXISTS "purgeAfter" TIMESTAMP(3);

-- İmha cron'unun tarama index'leri (purgeAfter <= now / deletedAt IS NOT NULL).
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX IF NOT EXISTS "Case_purgeAfter_idx" ON "Case"("purgeAfter");
CREATE INDEX IF NOT EXISTS "SecondOpinionCase_purgeAfter_idx" ON "SecondOpinionCase"("purgeAfter");
