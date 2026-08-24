-- ORTAK TAKVİM tablosu (2026-08-19, kullanıcı kararı "ortak database"): Doctorium etkinlik
-- takvimi + AURA Aşama-2 nöbet/icap planının tek evi. Takip edilen etkinlikler buraya
-- KOPYALANMAZ (CongressFollow'dan türetilir); tablo nöbet/icap/kişisel kayıtlar içindir —
-- MVP'de boş başlar, lib/calendar.ts'teki birleşim bloğu migration+generate sonrası açılır.
-- İdempotent (IF NOT EXISTS): eski şemalı kopyadan yeniden koşulursa güvenli.

CREATE TABLE IF NOT EXISTS "CalendarEntry" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "congressId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CalendarEntry_doctorId_startAt_idx" ON "CalendarEntry"("doctorId", "startAt");
