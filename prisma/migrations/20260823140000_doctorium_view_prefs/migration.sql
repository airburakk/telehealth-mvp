-- v6.140 — Doctorium görünüm süzgeçleri (Sektörel/İlaç & Cihaz/Mevzuat: Kaynak/Geriye dönük/
-- Kategori) kalıcı tercihe geçiyor (kullanıcı kararı 2026-08-23) — etkinlik türü/kapsamının
-- v6.132'de aldığı yolu izliyor: iki ayrı "Özelleştir" (başlıktaki /tercihler linki + sekme
-- içi geçici görünüm paneli) tek noktada birleşiyor; DoctoriumFilters.tsx siliniyor.
--
-- TEK kolon, JSON: altı dar kolon yerine feedModules/newsBranches deseni (genişleyebilir,
-- migration çoğalmaz). NULLABLE, varsayılansız: null = bugünkü sabit varsayılanlar (lib/doctorium
-- DEFAULT_RANGE=30, kategori=tümü, kaynak=tümü). Mevcut satırlar dokunulmadan aynı davranışı
-- görmeye devam eder.
--
-- Idempotent: aynı migration iki kez koşarsa (Neon dev branch provası + üretim) patlamaz.

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "doctoriumViewPrefs" TEXT;
