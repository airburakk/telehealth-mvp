-- 7-C (v6.286 · 2026-09-20): hukuki çeviri onayı — belge × dil × kanonik sürüm; onaylanan çeviri metni DONDURULUR (markdown).
-- Idempotent (DEPLOY.md Adım 2): yarıda düşen deploy yeniden koşulabilir.
CREATE TABLE IF NOT EXISTS "LegalTranslationApproval" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "note" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalTranslationApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LegalTranslationApproval_slug_lang_version_key" ON "LegalTranslationApproval"("slug", "lang", "version");
