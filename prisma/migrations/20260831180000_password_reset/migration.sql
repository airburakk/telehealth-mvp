-- v6.194 — "Şifremi unuttum" akışı (kullanıcı kararı 2026-08-31).
--
-- BOŞLUK: sistemde parola KURTARMA yolu HİÇ YOKTU. Parola *değiştirme* v6.187'de geldi ama o
-- oturum açmayı gerektirir; parolasını unutan üye giriş yapamıyor ve kendini kurtaramıyordu —
-- Doctorium üyeleri için gerçek bir kilitlenme (destek kanalı da yok).
--
-- İKİ YENİ NULLABLE KOLON — e-posta doğrulama alanlarıyla (emailVerifyTokenHash /
-- emailVerifySentAt) AYNI desen, ama bilinçli olarak AYRI kolonlar:
--   · TTL'ler farklı: doğrulama 24 saat, sıfırlama 1 saat (sıfırlama bağlantısı daha tehlikeli).
--   · Anlamları farklı: biri "bu adres sana mı ait", diğeri "parolayı değiştirme yetkisi".
--   Tek kolon paylaşsalardı, kullanıcı doğrulama e-postasını yeniden gönderdiğinde elindeki
--   sıfırlama bağlantısı SESSİZCE geçersizleşirdi (ve tersi) — teşhis edilmesi zor bir sınıf.
--
-- Token modeli (kullanıcı kararı: DB kolonu, imzalı token değil): 32 baytlık rastgele hex;
-- DB'de yalnız sha256 HASH'i durur, ham token yalnız e-postadaki bağlantıda bulunur. Kullanımda
-- hash NULL'lanır → tek kullanımlık. Parola değişince tüm oturumlar da düşürülür (sessionVersion).
--
-- BACKFILL YOK ve GEREKMEZ: her iki kolon da "şu anda bekleyen sıfırlama isteği" durumudur;
-- mevcut satırlar için doğru başlangıç değeri NULL'dur (bekleyen istek yok).
--
-- Idempotent: aynı migration iki kez koşarsa (Neon dev branch provası + üretim) patlamaz.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetSentAt" TIMESTAMP(3);
