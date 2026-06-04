-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "hotelStars" INTEGER NOT NULL,
    "hospitalType" TEXT NOT NULL,
    "nights" INTEGER NOT NULL,
    "translator" BOOLEAN NOT NULL DEFAULT false,
    "insuranceExtended" BOOLEAN NOT NULL DEFAULT false,
    "insuranceMalpractice" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "breakdown" TEXT NOT NULL,
    "split" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "escrowStatus" TEXT NOT NULL DEFAULT 'HELD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
