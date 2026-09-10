-- Hukuki set Paket 2 (2026-09-09) — 05-saklama-imha-politikasi.md + 06-veri-sahibi-basvuru-usul-esaslari.md
-- (vault output/doctorium-hukuki-belgeler/, Sürüm 1.4) vaat ettiği üç saklama/imha kuralının kod karşılığı.
-- Plan: .claude/plans/agile-percolating-snowglobe.md. İdempotent (IF NOT EXISTS).
--
-- SIRA (migration-ÖNCE — hafıza prisma-migrate-first): bu migration ÜRETİME uygulanır, SONRA bu kolonları
-- okuyan/yazan kod (lib/login-activity.ts · lib/abandoned-sweep.ts · lib/audit.ts purgedSeals ·
-- lib/kvkk-applications.ts) deploy edilir. Ters sıra eski şemada yeni client'ın implicit SELECT'ini kırar.
--
-- Doctor.lastLoginAt           : 05 madde 3.1b — terk edilmiş hesap süpürmesi (recordLogin damgalar).
-- Doctor.abandonedNoticeSentAt : "hesabınız 30 gün içinde silinecek" bildiriminin gönderildiği an.
-- AccessLog.purgedAt           : 05 madde 3.10 — 2 yıl sonra IP/cihaz boşaltma (ConsentRecord.purgedAt deseni).
-- KvkkApplication               : 06 madde B.2 — KVKK m.11 başvuru kütüğü + platform içi form.

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "abandonedNoticeSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Doctor_lastLoginAt_idx" ON "Doctor"("lastLoginAt");

-- AlterTable
ALTER TABLE "AccessLog" ADD COLUMN IF NOT EXISTS "purgedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KvkkApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decision" TEXT,
    "decidedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KvkkApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KvkkApplication_userId_idx" ON "KvkkApplication"("userId");
CREATE INDEX IF NOT EXISTS "KvkkApplication_status_createdAt_idx" ON "KvkkApplication"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "KvkkApplication_decidedAt_idx" ON "KvkkApplication"("decidedAt");
