-- CreateTable
CREATE TABLE "AuditChainAnchor" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "lastEntryHash" TEXT NOT NULL,
    "throughCreatedAt" TIMESTAMP(3) NOT NULL,
    "throughLogId" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "tsAuthority" TEXT NOT NULL,
    "tsTime" TIMESTAMP(3) NOT NULL,
    "tsToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditChainAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditChainAnchor_throughCreatedAt_idx" ON "AuditChainAnchor"("throughCreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditChainAnchor_day_key" ON "AuditChainAnchor"("day");
