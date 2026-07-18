-- Onam kaydı BAĞ-KORUYAN imha (purge ↔ zincir gerilimi çözümü, 2026-07-18 v6.24 bulgusu):
-- kabuk purge'unda ConsentRecord satırı artık SİLİNMEZ (fiziksel silme append-only hash zincirini
-- ortadan kırıyordu — sonraki kaydın prevHash bağı boşa düşer, verifyConsentChain kalıcı KIRIK olur).
-- Bunun yerine kişisel alanlar (ip, userAgent) boşaltılır + purgedAt damgalanır; doğrulayıcı purged
-- satırda mühür kontrolünü atlar ama zincir bağını sürdürür. Idempotent (yarım kalan deploy kilitlemesin).
ALTER TABLE "ConsentRecord" ADD COLUMN IF NOT EXISTS "purgedAt" TIMESTAMP(3);
