-- v6.206 (2026-09-02 gece) — NewsArticle.summaryOriginal: özgün dildeki özet TAM metni (giriş çevirisi uygulandıysa).
--
-- SORUN (kullanıcı bildirimi: "özet yok, sadece başlıklar çevrilmiş"): çeviri hattı (lib/translate-news,
-- 2026-08-31 / 09-02) yalnız BAŞLIĞI çeviriyordu; abstract / briefSummary / RSS açıklaması İngilizce kalıyor ve
-- akış kartı + Post + sosyal bülten ona aynen basıyordu (canlıda doğrulandı: Türkçe başlık altında
-- "Talquetamab, a bispecific antibody…").
--
-- ÇÖZÜM: titleOriginal ile SİMETRİK — summary = gösterim metni (çevrilmişse Türkçe GİRİŞ, ~700 kar., cümle
-- sınırı), summaryOriginal = özgün tam metin. Doldurma ingest'te DEĞİL ayrı cron'da (api/cron/translate-news,
-- 02:40 UTC; lib/translate-summaries): yeni→eski sırayla, gecelik bütçe kaldığınca birikmişi de kapatır —
-- PROD'a yerelden backfill script'i gerekmez. Kolon aynı zamanda "işlendi" damgasıdır (NULL = henüz çeviri
-- cron'undan geçmedi); Türkçe doğan kaynaklar (RG/TTB/Yargıtay/…) hiç seçilmediği için NULL kalır.
-- AI özetleri (ensureClinicalSummary / ensureRegulationSummary) kaynak metin olarak BUNU (varsa) okur.
--
-- TEK KOLON, NULLABLE, BACKFILL YOK. Kod↔migration sırası: yeni kolon = migration ÖNCE (prisma-migrate-first).
-- Idempotent: aynı migration iki kez koşarsa (Neon dev branch provası + üretim) patlamaz.

ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "summaryOriginal" TEXT;
