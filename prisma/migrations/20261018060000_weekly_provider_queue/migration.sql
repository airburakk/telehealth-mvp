ALTER TABLE "WeeklyChannelDelivery"
 ADD COLUMN "enqueueAt" TIMESTAMP(3), ADD COLUMN "provider" TEXT,
 ADD COLUMN "providerQueueId" TEXT, ADD COLUMN "additionalQueueRisk" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "providerDueAt" TIMESTAMP(3),
 ADD COLUMN "queuedAt" TIMESTAMP(3), ADD COLUMN "remoteObservedAt" TIMESTAMP(3),
 ADD COLUMN "cancelRequestedAt" TIMESTAMP(3), ADD COLUMN "cancelConfirmedAt" TIMESTAMP(3),
 ADD COLUMN "publishedUrl" TEXT, ADD COLUMN "remotePublishedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "WeeklyChannelDelivery_provider_providerQueueId_key" ON "WeeklyChannelDelivery"("provider","providerQueueId");
ALTER TABLE "WeeklyChannelDelivery" DROP CONSTRAINT "WeeklyChannelDelivery_state_check";
ALTER TABLE "WeeklyChannelDelivery" ADD CONSTRAINT "WeeklyChannelDelivery_state_check" CHECK
 ("state" IN ('PENDING','CLAIMED','SUCCEEDED','FAILED','UNKNOWN','CANCELLED',
 'QUEUED','PUBLICATION_UNKNOWN','CANCEL_PENDING','CANCEL_UNKNOWN','PUBLISHED_RISK'));

-- An already queued or possibly accepted remote job is NOT unsent by a local revoke.
CREATE OR REPLACE FUNCTION invalidate_weekly_content_package() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."weeklyPackageId" IS NOT NULL AND (
   NEW."payload" IS DISTINCT FROM OLD."payload" OR NEW."sourceIds" IS DISTINCT FROM OLD."sourceIds" OR
   NEW."attestIdentity" IS DISTINCT FROM OLD."attestIdentity" OR NEW."approvedHash" IS DISTINCT FROM OLD."approvedHash" OR
   NEW."slotDay" IS DISTINCT FROM OLD."slotDay" OR NEW."seriesKey" IS DISTINCT FROM OLD."seriesKey" OR
   NEW."status" NOT IN ('APPROVED','PUBLISHING','PUBLISHED')
 ) THEN
   UPDATE "WeeklyContentPackage" SET "status"='REVOKED', "revokedReason"='CONTENT_CHANGED', "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=OLD."weeklyPackageId" AND "status"='APPROVED';
   INSERT INTO "WeeklyDeliveryEvent" ("id","deliveryId","state","note")
     SELECT 'cancel_' || md5(d."id" || clock_timestamp()::text || random()::text), d."id",
       CASE WHEN d."state"='PENDING' THEN 'CANCELLED' WHEN d."state"='QUEUED' THEN 'CANCEL_PENDING' ELSE 'CANCEL_UNKNOWN' END,
       'CONTENT_CHANGED_REMOTE_UNSEND_NOT_CONFIRMED'
     FROM "WeeklyChannelDelivery" d WHERE d."packageId"=OLD."weeklyPackageId"
       AND d."state" IN ('PENDING','QUEUED','CLAIMED','UNKNOWN','PUBLICATION_UNKNOWN');
   UPDATE "WeeklyChannelDelivery" SET
     "state"=CASE WHEN "state"='PENDING' THEN 'CANCELLED' WHEN "state"='QUEUED' THEN 'CANCEL_PENDING' ELSE 'CANCEL_UNKNOWN' END,
     "cancelRequestedAt"=CASE WHEN "state"='PENDING' THEN "cancelRequestedAt" ELSE COALESCE("cancelRequestedAt",CURRENT_TIMESTAMP) END,
     "resultNote"='CONTENT_CHANGED_REMOTE_UNSEND_NOT_CONFIRMED', "updatedAt"=CURRENT_TIMESTAMP
     WHERE "packageId"=OLD."weeklyPackageId" AND "state" IN ('PENDING','QUEUED','CLAIMED','UNKNOWN','PUBLICATION_UNKNOWN');
 END IF;
 RETURN NEW;
END $$;
