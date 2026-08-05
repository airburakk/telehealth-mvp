-- Apple ile Giriş (v6.82) — User.appleSub: Apple'ın kalıcı kullanıcı kimliği (ID token `sub`).
-- İdempotent (IF NOT EXISTS) — DEPLOY.md Adım 2 kuralı.
--
-- Neden e-posta yetmiyor: "E-postamı Gizle" seçen kullanıcının @privaterelay.appleid.com adresi,
-- uygulama Apple ID'den kaldırılıp yeniden bağlanınca DEĞİŞİR → yalnız e-postaya bakan eşleme aynı
-- kişiye ikinci hesap açardı. `sub` opaktır ve kullanıcı-uygulama çifti için değişmez.
--
-- NULL'lar Postgres'te unique index'i ihlal etmez → Apple kullanmayan hesaplar etkilenmez,
-- geriye dönük veri taşıması GEREKMEZ (kolon boş başlar, ilk Apple girişinde dolar).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "appleSub" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_appleSub_key" ON "User"("appleSub");
