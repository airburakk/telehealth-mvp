-- Sistem mesajları + etik kurul savunma/bilgi talebi (v6.79).
-- İdempotent (IF NOT EXISTS) — DEPLOY.md Adım 2 kuralı.
-- Complaint.respondentType: hastanın bildirdiği ilgili/karşı taraf (DOCTOR|AGENCY|HOSPITAL|OTHER).
-- SystemMessage: bildirimden ayrı, içerikli + talep→yanıt akışlı mesaj (body/reply şifreli).

ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "respondentType" TEXT;

CREATE TABLE IF NOT EXISTS "SystemMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "threadKey" TEXT,
    "needsReply" BOOLEAN NOT NULL DEFAULT false,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedByUserId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SystemMessage_role_readAt_idx" ON "SystemMessage"("role", "readAt");

CREATE INDEX IF NOT EXISTS "SystemMessage_userId_readAt_idx" ON "SystemMessage"("userId", "readAt");

CREATE INDEX IF NOT EXISTS "SystemMessage_threadKey_idx" ON "SystemMessage"("threadKey");
