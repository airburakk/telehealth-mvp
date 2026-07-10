-- Değişiklik paketi 2026-07-10 (v5 hazırlığı):
--   1) Case: hasta iletişim (telefon + tercih) · tedavi kararı (süre gün aralığı + hastane) ·
--      STA iletim damgası · hasta epikriz talebi
--   2) SecondOpinionCase: hasta iletişim (telefon + tercih)
--   3) Doctor: cep telefonu + bildirim kanalı tercihi + HealthTürkiye kayıt doğrulaması
--   4) Yeni tablolar: RegistryDoctor / RegistryHospital / RegistryReport (healthturkiye.gov.tr günlük senkron)
-- Tümü additive/nullable (migration-önce güvenli). İdempotent — yarıda kalırsa yeniden koşulabilir.

-- 1) Case — hasta iletişim + tedavi kararı + STA + epikriz talebi
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "patientPhone" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "contactPreference" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "treatmentDaysMin" INTEGER;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "treatmentDaysMax" INTEGER;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "hospitalRegistryId" INTEGER;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "hospitalName" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "agencySentAt" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "dischargeRequestedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Case_agencySentAt_idx" ON "Case"("agencySentAt");

-- 2) SecondOpinionCase — hasta iletişim
ALTER TABLE "SecondOpinionCase" ADD COLUMN IF NOT EXISTS "patientPhone" TEXT;
ALTER TABLE "SecondOpinionCase" ADD COLUMN IF NOT EXISTS "contactPreference" TEXT;

-- 3) Doctor — bildirim kanalı + kayıt doğrulaması
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "notifyChannel" TEXT NOT NULL DEFAULT 'APP';
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "registryStatus" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "registryCheckedAt" TIMESTAMP(3);

-- 4a) RegistryDoctor — healthturkiye.gov.tr doktor dizini (kamuya açık; PHI değil)
CREATE TABLE IF NOT EXISTS "RegistryDoctor" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobName" TEXT,
    "jobId" INTEGER,
    "branchName" TEXT,
    "branchId" INTEGER,
    "cityId" INTEGER,
    "cityName" TEXT,
    "establishmentId" INTEGER,
    "establishmentName" TEXT,
    "slug" TEXT,
    "address" TEXT,
    "experience" INTEGER,
    "genderId" INTEGER,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "RegistryDoctor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegistryDoctor_branchId_idx" ON "RegistryDoctor"("branchId");
CREATE INDEX IF NOT EXISTS "RegistryDoctor_cityId_idx" ON "RegistryDoctor"("cityId");
CREATE INDEX IF NOT EXISTS "RegistryDoctor_establishmentId_idx" ON "RegistryDoctor"("establishmentId");
CREATE INDEX IF NOT EXISTS "RegistryDoctor_jobId_idx" ON "RegistryDoctor"("jobId");
CREATE INDEX IF NOT EXISTS "RegistryDoctor_removedAt_idx" ON "RegistryDoctor"("removedAt");
CREATE INDEX IF NOT EXISTS "RegistryDoctor_lastName_name_idx" ON "RegistryDoctor"("lastName", "name");

-- 4b) RegistryHospital — healthturkiye.gov.tr tesis dizini
CREATE TABLE IF NOT EXISTS "RegistryHospital" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "cityName" TEXT,
    "cityCode" TEXT,
    "cityHasAirport" BOOLEAN,
    "address" TEXT,
    "phone" TEXT,
    "totalPersonnel" INTEGER,
    "unitCapacity" INTEGER,
    "facilityTypeId" INTEGER,
    "facilityTypeName" TEXT,
    "accreditationCount" INTEGER,
    "certificationCount" INTEGER,
    "insuranceCount" INTEGER,
    "doctorCount" INTEGER,
    "foundationYear" INTEGER,
    "latitude" TEXT,
    "longitude" TEXT,
    "branches" TEXT,
    "treatments" TEXT,
    "languages" TEXT,
    "accreditations" TEXT,
    "facilities" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "RegistryHospital_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegistryHospital_cityCode_idx" ON "RegistryHospital"("cityCode");
CREATE INDEX IF NOT EXISTS "RegistryHospital_facilityTypeId_idx" ON "RegistryHospital"("facilityTypeId");
CREATE INDEX IF NOT EXISTS "RegistryHospital_removedAt_idx" ON "RegistryHospital"("removedAt");

-- 4c) RegistryReport — günlük senkron raporu (doktor+hastane tek rapor)
CREATE TABLE IF NOT EXISTS "RegistryReport" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "doctorsTotal" INTEGER NOT NULL DEFAULT 0,
    "hospitalsTotal" INTEGER NOT NULL DEFAULT 0,
    "addedDoctors" TEXT,
    "removedDoctors" TEXT,
    "addedHospitals" TEXT,
    "removedHospitals" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistryReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegistryReport_date_key" ON "RegistryReport"("date");
CREATE INDEX IF NOT EXISTS "RegistryReport_createdAt_idx" ON "RegistryReport"("createdAt");
