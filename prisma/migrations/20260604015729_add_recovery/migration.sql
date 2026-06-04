-- CreateTable
CREATE TABLE "Recovery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recovery_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recoveryId" TEXT NOT NULL,
    "pain" INTEGER NOT NULL,
    "feverC" REAL NOT NULL,
    "meds" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "photo" TEXT,
    "severity" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckIn_recoveryId_fkey" FOREIGN KEY ("recoveryId") REFERENCES "Recovery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Recovery_caseId_key" ON "Recovery"("caseId");
