-- v6.99.2: Haber detayında kaynağın kendi görseli (kullanıcı isteği 2026-08-16).
-- imageUrl = kaynak sayfanın og:image / RSS media görseli; YALNIZ allowlist'li host'lardan
-- yazılır (lib/doctorium-sources.ts NEWS_IMAGE_HOSTS ↔ next.config.ts img-src sözleşmesi).
-- Görsel BARINDIRILMAZ (hotlink) — telif gereği kopya alınmaz; null = üretilmiş kapak (CoverArt).
ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
