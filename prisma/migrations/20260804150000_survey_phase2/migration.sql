-- Doctorium anket modülü Faz 2 (v6.69): tek-sorulu anket + doktor-başına-tek yanıt.
-- İdempotent (IF NOT EXISTS) — DEPLOY.md Adım 2 kuralı. honorarium alanı hazır ama >0 iken
-- ACTIVE API kilidi var (ödeme/vergi kurgusu kullanıcı kararı bekliyor — kurgu gelince şema hazır).

CREATE TABLE IF NOT EXISTS "Survey" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'COMMUNITY',
    "sponsor" TEXT,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "honorarium" INTEGER,
    "targetBranches" TEXT,
    "targetCities" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Survey_status_startsAt_endsAt_idx"
    ON "Survey"("status", "startsAt", "endsAt");

CREATE TABLE IF NOT EXISTS "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SurveyResponse_surveyId_doctorId_key"
    ON "SurveyResponse"("surveyId", "doctorId");

CREATE INDEX IF NOT EXISTS "SurveyResponse_surveyId_optionIndex_idx"
    ON "SurveyResponse"("surveyId", "optionIndex");

-- FK: Prisma varsayılan adlandırmasıyla, çift-koşuda patlamasın diye koşullu ekle.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SurveyResponse_surveyId_fkey'
    ) THEN
        ALTER TABLE "SurveyResponse"
            ADD CONSTRAINT "SurveyResponse_surveyId_fkey"
            FOREIGN KEY ("surveyId") REFERENCES "Survey"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
