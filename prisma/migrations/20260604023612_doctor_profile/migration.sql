-- AlterTable
ALTER TABLE "User" ADD COLUMN "doctorId" TEXT;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Doctor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "languages" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "bio" TEXT,
    "color" TEXT NOT NULL DEFAULT '#16467a',
    "rating" REAL NOT NULL DEFAULT 4.7,
    "successRate" INTEGER NOT NULL DEFAULT 95,
    "experienceYears" INTEGER NOT NULL DEFAULT 12,
    "jci" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Doctor" ("bio", "branch", "city", "color", "createdAt", "id", "languages", "name", "title", "verified") SELECT "bio", "branch", "city", "color", "createdAt", "id", "languages", "name", "title", "verified" FROM "Doctor";
DROP TABLE "Doctor";
ALTER TABLE "new_Doctor" RENAME TO "Doctor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
