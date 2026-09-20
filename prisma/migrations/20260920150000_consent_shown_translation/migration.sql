-- Paket 7 (v6.285, 2026-09-20 — hukuki metin tam lokalizasyon, 👤 karar A): onam kaydına GÖSTERİLEN ÇEVİRİNİN dili ve
-- hash'i. Kanonik metin (TR/EN) hash'i `textHash`'te ve mühürde DEĞİŞMEZ; bu iki sütun ispat eki (hasta hangi dilde,
-- hangi çeviri metnini okudu). Nullable — eski kayıtlar ve TR/EN okuyanlar null. Mühür formülüne dahil DEĞİL (v2 imzası korunur).
ALTER TABLE "ConsentRecord" ADD COLUMN "shownLang" TEXT;
ALTER TABLE "ConsentRecord" ADD COLUMN "shownTextHash" TEXT;
