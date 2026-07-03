-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "doctorId" TEXT,
    "partnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerDoctor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Dr.',
    "country" TEXT NOT NULL,
    "institution" TEXT,
    "branch" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "language" TEXT DEFAULT 'İngilizce',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerDoctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'GENERAL_KVKK',
    "version" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "textHash" TEXT,
    "userAgent" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WEB',
    "prevHash" TEXT,
    "entryHash" TEXT,
    "tsAuthority" TEXT,
    "tsTime" TIMESTAMP(3),
    "tsToken" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "languages" TEXT NOT NULL,
    "markets" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "bio" TEXT,
    "color" TEXT NOT NULL DEFAULT '#16467a',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.7,
    "successRate" INTEGER NOT NULL DEFAULT 95,
    "experienceYears" INTEGER NOT NULL DEFAULT 12,
    "jci" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "procedures" TEXT,
    "licenseNo" TEXT,
    "eduSchool" TEXT,
    "eduYear" INTEGER,
    "specBoard" TEXT,
    "specYear" INTEGER,
    "certifications" TEXT,
    "publications" TEXT,
    "photo" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "proBonoOptIn" BOOLEAN NOT NULL DEFAULT false,
    "consultOptIn" BOOLEAN NOT NULL DEFAULT false,
    "proBonoState" TEXT NOT NULL DEFAULT 'OFFLINE',
    "proBonoQuota" INTEGER NOT NULL DEFAULT 10,
    "proBonoUsed" INTEGER NOT NULL DEFAULT 0,
    "proBonoResetAt" TIMESTAMP(3),
    "proBonoAvailableAt" TIMESTAMP(3),
    "clinicalState" TEXT NOT NULL DEFAULT 'OFFLINE',
    "onCall" BOOLEAN NOT NULL DEFAULT false,
    "sentinel" BOOLEAN NOT NULL DEFAULT false,
    "clinicalAvailableAt" TIMESTAMP(3),
    "icapNotified" INTEGER NOT NULL DEFAULT 0,
    "icapOffered" INTEGER NOT NULL DEFAULT 0,
    "respCount" INTEGER NOT NULL DEFAULT 0,
    "respTotalSec" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "mmssInsurer" TEXT,
    "mmssPolicyNo" TEXT,
    "mmssCoverageLimit" INTEGER,
    "mmssCoverageCurrency" TEXT DEFAULT 'TRY',
    "mmssValidUntil" TIMESTAMP(3),
    "mmssVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "patientName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "patientIdentifier" TEXT,
    "patientIdentifierType" TEXT,
    "symptoms" TEXT NOT NULL,
    "durationText" TEXT,
    "extra" TEXT,
    "attachments" TEXT,
    "branch" TEXT NOT NULL,
    "urgency" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 70,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "consultFee" INTEGER,
    "payStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "payMethod" TEXT,
    "policyNo" TEXT,
    "payRef" TEXT,
    "dischargeReport" TEXT,
    "dischargeStructured" TEXT,
    "dischargeAt" TIMESTAMP(3),
    "icd10Code" TEXT,
    "labResults" TEXT,
    "recommendedProcedures" TEXT,
    "proBono" BOOLEAN NOT NULL DEFAULT false,
    "proBonoStatus" TEXT,
    "doctorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationRequest" (
    "id" TEXT NOT NULL,
    "sourceCaseId" TEXT,
    "requestedByPartnerId" TEXT,
    "requestedByName" TEXT,
    "branch" TEXT,
    "region" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "urgency" INTEGER NOT NULL DEFAULT 3,
    "icd10Code" TEXT,
    "clinicalSummary" TEXT NOT NULL,
    "summaryTr" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "engagedByDoctorId" TEXT,
    "answeredByDoctorId" TEXT,
    "answerText" TEXT,
    "answerTr" TEXT,
    "recommendedLabs" TEXT,
    "recommendedImaging" TEXT,
    "medications" TEXT,
    "paymentSim" INTEGER,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "translated" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationVideoAppointment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OFFERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationVideoAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationRequestDocument" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "fileData" TEXT NOT NULL,
    "docType" TEXT,
    "aiSummary" TEXT,
    "aiTranslation" TEXT,
    "aiFlags" TEXT,
    "aiLabs" TEXT,
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationRequestDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultAppointment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT,
    "branch" TEXT NOT NULL,
    "doctorId" TEXT,
    "proposedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "consultationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
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
    "insuranceLevel" INTEGER NOT NULL DEFAULT 1,
    "insuranceDetail" TEXT,
    "subtotal" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "breakdown" TEXT NOT NULL,
    "split" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "escrowStatus" TEXT NOT NULL DEFAULT 'HELD',
    "journeyData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" TEXT,
    "aiDocType" TEXT,
    "aiSummary" TEXT,
    "aiTranslation" TEXT,
    "aiFlags" TEXT,
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorDocument" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recovery" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),

    CONSTRAINT "Recovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "recoveryId" TEXT NOT NULL,
    "pain" INTEGER NOT NULL,
    "feverC" DOUBLE PRECISION NOT NULL,
    "meds" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "photo" TEXT,
    "severity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" SERIAL NOT NULL,
    "consultationId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "bookingId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verdict" TEXT,
    "action" TEXT,
    "refundAmount" INTEGER,
    "rationale" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "recipientName" TEXT,
    "scopes" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "allowDownload" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "role" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "translated" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareAccess" (
    "id" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "detail" TEXT,
    "seenByPatient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondOpinionCase" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "diagnosisSummary" TEXT NOT NULL,
    "country" TEXT,
    "language" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "assignedDoctorId" TEXT,
    "consentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "opinionDeliveredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecondOpinionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondOpinionDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "deliveryMethod" TEXT NOT NULL,
    "fileRef" TEXT,
    "externalRef" TEXT,
    "label" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecondOpinionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondOpinionRequest" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "SecondOpinionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondOpinion" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "structured" TEXT,
    "attachments" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecondOpinion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondOpinionAppointment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "externalVideoRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecondOpinionAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondOpinionPayment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 600,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecondOpinionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecondOpinionEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecondOpinionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "subjectUserId" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prevHash" TEXT,
    "entryHash" TEXT,
    "tsAuthority" TEXT,
    "tsTime" TIMESTAMP(3),
    "tsToken" TEXT,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerDoctor_email_key" ON "PartnerDoctor"("email");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_userId_scope_version_key" ON "ConsentRecord"("userId", "scope", "version");

-- CreateIndex
CREATE INDEX "Case_userId_idx" ON "Case"("userId");

-- CreateIndex
CREATE INDEX "Case_proBono_proBonoStatus_idx" ON "Case"("proBono", "proBonoStatus");

-- CreateIndex
CREATE INDEX "ConsultationRequest_status_branch_idx" ON "ConsultationRequest"("status", "branch");

-- CreateIndex
CREATE INDEX "ConsultationRequest_requestedByPartnerId_idx" ON "ConsultationRequest"("requestedByPartnerId");

-- CreateIndex
CREATE INDEX "ConsultationMessage_requestId_idx" ON "ConsultationMessage"("requestId");

-- CreateIndex
CREATE INDEX "ConsultationVideoAppointment_requestId_idx" ON "ConsultationVideoAppointment"("requestId");

-- CreateIndex
CREATE INDEX "ConsultationVideoAppointment_doctorId_idx" ON "ConsultationVideoAppointment"("doctorId");

-- CreateIndex
CREATE INDEX "ConsultationVideoAppointment_partnerId_idx" ON "ConsultationVideoAppointment"("partnerId");

-- CreateIndex
CREATE INDEX "ConsultationRequestDocument_requestId_idx" ON "ConsultationRequestDocument"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultAppointment_caseId_key" ON "ConsultAppointment"("caseId");

-- CreateIndex
CREATE INDEX "ConsultAppointment_branch_status_idx" ON "ConsultAppointment"("branch", "status");

-- CreateIndex
CREATE INDEX "CaseDocument_caseId_idx" ON "CaseDocument"("caseId");

-- CreateIndex
CREATE INDEX "DoctorDocument_doctorId_idx" ON "DoctorDocument"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "Recovery_caseId_key" ON "Recovery"("caseId");

-- CreateIndex
CREATE INDEX "Signal_consultationId_idx" ON "Signal"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_caseId_idx" ON "ShareLink"("caseId");

-- CreateIndex
CREATE INDEX "Notification_role_readAt_idx" ON "Notification"("role", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_lang_sourceHash_key" ON "Translation"("lang", "sourceHash");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_role_idx" ON "PushSubscription"("role");

-- CreateIndex
CREATE INDEX "ShareAccess_shareLinkId_idx" ON "ShareAccess"("shareLinkId");

-- CreateIndex
CREATE INDEX "SecondOpinionCase_patientId_idx" ON "SecondOpinionCase"("patientId");

-- CreateIndex
CREATE INDEX "SecondOpinionCase_assignedDoctorId_idx" ON "SecondOpinionCase"("assignedDoctorId");

-- CreateIndex
CREATE INDEX "SecondOpinionCase_status_idx" ON "SecondOpinionCase"("status");

-- CreateIndex
CREATE INDEX "SecondOpinionDocument_caseId_idx" ON "SecondOpinionDocument"("caseId");

-- CreateIndex
CREATE INDEX "SecondOpinionRequest_caseId_idx" ON "SecondOpinionRequest"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "SecondOpinion_caseId_key" ON "SecondOpinion"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "SecondOpinionAppointment_caseId_key" ON "SecondOpinionAppointment"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "SecondOpinionPayment_caseId_key" ON "SecondOpinionPayment"("caseId");

-- CreateIndex
CREATE INDEX "SecondOpinionEvent_caseId_idx" ON "SecondOpinionEvent"("caseId");

-- CreateIndex
CREATE INDEX "AccessLog_subjectUserId_createdAt_idx" ON "AccessLog"("subjectUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_resourceType_resourceId_idx" ON "AccessLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AccessLog_actorId_idx" ON "AccessLog"("actorId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationMessage" ADD CONSTRAINT "ConsultationMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ConsultationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationRequestDocument" ADD CONSTRAINT "ConsultationRequestDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ConsultationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocument" ADD CONSTRAINT "CaseDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorDocument" ADD CONSTRAINT "DoctorDocument_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recovery" ADD CONSTRAINT "Recovery_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_recoveryId_fkey" FOREIGN KEY ("recoveryId") REFERENCES "Recovery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAccess" ADD CONSTRAINT "ShareAccess_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondOpinionDocument" ADD CONSTRAINT "SecondOpinionDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SecondOpinionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondOpinionRequest" ADD CONSTRAINT "SecondOpinionRequest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SecondOpinionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondOpinion" ADD CONSTRAINT "SecondOpinion_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SecondOpinionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondOpinionAppointment" ADD CONSTRAINT "SecondOpinionAppointment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SecondOpinionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondOpinionPayment" ADD CONSTRAINT "SecondOpinionPayment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SecondOpinionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondOpinionEvent" ADD CONSTRAINT "SecondOpinionEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SecondOpinionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

