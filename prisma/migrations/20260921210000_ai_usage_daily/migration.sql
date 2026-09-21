-- v6.298 (2026-09-21): AI kullanım sayacı — gün (UTC) × özellik × model toplamları; içerik/PHI YOK, yalnız sayılar (lib/ai-usage).
-- Idempotent (DEPLOY.md Adım 2): yarıda düşen deploy yeniden koşulabilir.
CREATE TABLE IF NOT EXISTS "AiUsageDaily" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsageDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageDaily_day_feature_model_key" ON "AiUsageDaily"("day", "feature", "model");

CREATE INDEX IF NOT EXISTS "AiUsageDaily_day_idx" ON "AiUsageDaily"("day");
