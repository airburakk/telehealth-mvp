-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "congressAlertDays" INTEGER,
ADD COLUMN IF NOT EXISTS "congressDeadlineAlertDays" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CongressFollow" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "congressId" TEXT NOT NULL,
    "sentAlerts" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CongressFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CongressFollow_congressId_idx" ON "CongressFollow"("congressId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CongressFollow_doctorId_congressId_key" ON "CongressFollow"("doctorId", "congressId");

