-- v6.132 — Etkinlik TÜRÜ ve KAPSAM tercihi kalıcı hale geliyor (kullanıcı kararı 2026-08-20).
--
-- Gerekçe: iki süzgeç şimdiye kadar yalnız URL'de yaşıyordu (?t= ve ?s=); sekmeden çıkınca
-- unutuluyordu. Tercihler sayfasına taşınınca "ayarladım" hissi verip her girişte varsayılana
-- dönmemeleri için Doctor satırına yazılmaları gerekti.
--
-- İki kolon da NULLABLE ve varsayılansız: null = bugünkü davranış (tür → kongre+sempozyum,
-- kapsam → tümü). Mevcut satırlar dokunulmadan aynı akışı görmeye devam eder; geri alma
-- gerekirse kolonlar okunmaz hale getirilir, veri kaybı olmaz.
--
-- Idempotent: aynı migration iki kez koşarsa (Neon dev branch provası + üretim) patlamaz.

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "congressEventTypes" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "congressScope" TEXT;
