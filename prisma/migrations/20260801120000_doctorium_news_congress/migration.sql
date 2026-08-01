-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "newsBranches" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "NewsArticle" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "branchSlugs" TEXT NOT NULL DEFAULT '[]',
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleOriginal" TEXT,
    "summary" TEXT NOT NULL,
    "aiSummary" TEXT,
    "sourceName" TEXT NOT NULL,
    "authors" TEXT,
    "url" TEXT,
    "doi" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MedicalCongress" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organizer" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'TR',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "abstractDeadline" TIMESTAMP(3),
    "earlyBirdDeadline" TIMESTAMP(3),
    "url" TEXT,
    "branchSlugs" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalCongress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsArticle_module_publishedAt_idx" ON "NewsArticle"("module", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NewsArticle_source_externalId_key" ON "NewsArticle"("source", "externalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MedicalCongress_startDate_idx" ON "MedicalCongress"("startDate");

