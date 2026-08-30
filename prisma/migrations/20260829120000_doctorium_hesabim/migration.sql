-- v6.184 — Doctorium "Hesabım" bölümü (kullanıcı kararı 2026-08-29).
--
-- İKİ YENİ NULLABLE KOLON. Doctorium'da klinik katman YOKTUR (hasta/vaka/görüş yok) — bu bölüm
-- yalnız üyelik verisini yönetir: kayıt bilgileri, mezun belgesi, kaydettikleri, takip/takvim,
-- puanlar, akış tercihleri.
--
-- 1) User.passwordSetAt — "bu hesapta kullanıcının BİLDİĞİ bir parola var mı?"
--    Google/Apple ile açılan hesaplara rastgele 24 baytlık gölge-hash yazılıyor (auth/google/
--    callback + apple/callback: hashPassword(randomBytes(24))) ve bu, parolayla açılmış hesaptan
--    AYIRT EDİLEMİYORDU. Ayrım olmadan "mevcut şifrenizi girin" formu OAuth kullanıcısına
--    geçilemez bir kapı gösterirdi. Dolu = parola kullanıcı tarafından belirlendi.
--
--    ⚠️ BACKFILL DÜRÜSTLÜĞÜ: mevcut satırlar createdAt ile damgalanır (appleSub dolu olanlar
--    HARİÇ — onlar kesin OAuth). Google ile açılmış eski hesaplar bu backfill'de yanlışlıkla
--    "parolası var" görünür; ayırt edici bir iz yok. Prod'da bugün gerçek doktor hesabı
--    bulunmadığı (lansmanda kayıtlar sıfırlanacak) için etki pratikte yok; yanlış damgalı bir
--    hesap yalnız "parola belirle" yerine "parola değiştir" formu görür ve deneme başarısız olur.
--
-- 2) Doctor.doctoriumOptOutAt — AURA klinik hesabı da olan (Aşama 2) doktorun Doctorium
--    üyeliğinden çıkışı. Hesap KAPANMAZ (kullanıcı kararı): yalnız Doctorium katmanı silinir ve
--    erişim kapanır. Kapıyı kapatmak için ayrı bir damga şart — hasDoctoriumAccess bugün
--    diplomaVerifiedAt/studentVerifiedAt'a bakıyor ve o damgalar üyelikten çıkışta SİLİNMEZ
--    (diploma doğrulaması klinik tarafın da dayanağı). Dolu = Doctorium'a girmez; yeniden üye
--    olunca null'lanır.
--
-- Idempotent: aynı migration iki kez koşarsa (Neon dev branch provası + üretim) patlamaz.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordSetAt" TIMESTAMP(3);
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "doctoriumOptOutAt" TIMESTAMP(3);

-- Backfill (yukarıdaki dürüstlük notu): Apple bağı olanlar kesin OAuth → damgasız kalır.
UPDATE "User"
   SET "passwordSetAt" = "createdAt"
 WHERE "passwordSetAt" IS NULL
   AND "appleSub" IS NULL;
