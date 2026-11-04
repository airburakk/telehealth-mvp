CREATE TABLE "WeeklyContentPackage" (
 "id" TEXT NOT NULL PRIMARY KEY, "week" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "manifest" TEXT NOT NULL, "manifestHash" TEXT NOT NULL, "approvedAt" TIMESTAMP(3),
 "approvedById" TEXT, "approvedBy" TEXT, "revokedReason" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "WeeklyContentPackage_status_check" CHECK ("status" IN ('DRAFT','APPROVED','REVOKED'))
);
CREATE INDEX "WeeklyContentPackage_week_createdAt_idx" ON "WeeklyContentPackage"("week","createdAt");
ALTER TABLE "ContentPlanItem" ADD COLUMN "weeklyPackageId" TEXT;
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_weeklyPackageId_fkey"
 FOREIGN KEY ("weeklyPackageId") REFERENCES "WeeklyContentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "WeeklyChannelDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY, "packageId" TEXT NOT NULL, "itemId" TEXT NOT NULL,
 "channel" TEXT NOT NULL, "accountId" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'PENDING',
 "scheduledAt" TIMESTAMP(3) NOT NULL, "attempt" INTEGER NOT NULL DEFAULT 0,
 "claimToken" TEXT, "claimedAt" TIMESTAMP(3), "platformId" TEXT, "resultNote" TEXT,
 "reconciledById" TEXT, "reconciledAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "WeeklyChannelDelivery_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "WeeklyContentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "WeeklyChannelDelivery_state_check" CHECK ("state" IN ('PENDING','CLAIMED','SUCCEEDED','FAILED','UNKNOWN','CANCELLED')),
 CONSTRAINT "WeeklyChannelDelivery_channel_check" CHECK ("channel" IN ('x','instagram','facebook','linkedin','youtube'))
);
CREATE UNIQUE INDEX "WeeklyChannelDelivery_itemId_channel_key" ON "WeeklyChannelDelivery"("itemId","channel");
CREATE INDEX "WeeklyChannelDelivery_packageId_state_scheduledAt_idx" ON "WeeklyChannelDelivery"("packageId","state","scheduledAt");
CREATE TABLE "WeeklyDeliveryEvent" (
 "id" TEXT NOT NULL PRIMARY KEY, "deliveryId" TEXT NOT NULL, "state" TEXT NOT NULL,
 "note" TEXT NOT NULL, "actorId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WeeklyDeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "WeeklyChannelDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WeeklyDeliveryEvent_deliveryId_createdAt_idx" ON "WeeklyDeliveryEvent"("deliveryId","createdAt");

-- Edits via the existing editor invalidate the entire receipt in the SAME transaction.
-- A claim's APPROVED -> PUBLISHING transition does not change approved content.
CREATE FUNCTION invalidate_weekly_content_package() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."weeklyPackageId" IS NOT NULL AND (
   NEW."payload" IS DISTINCT FROM OLD."payload" OR NEW."sourceIds" IS DISTINCT FROM OLD."sourceIds" OR
   NEW."attestIdentity" IS DISTINCT FROM OLD."attestIdentity" OR NEW."approvedHash" IS DISTINCT FROM OLD."approvedHash" OR
   NEW."slotDay" IS DISTINCT FROM OLD."slotDay" OR NEW."seriesKey" IS DISTINCT FROM OLD."seriesKey" OR
   NEW."status" NOT IN ('APPROVED','PUBLISHING','PUBLISHED')
 ) THEN
   UPDATE "WeeklyContentPackage" SET "status"='REVOKED', "revokedReason"='CONTENT_CHANGED', "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=OLD."weeklyPackageId" AND "status"='APPROVED';
   UPDATE "WeeklyChannelDelivery" SET "state"='CANCELLED', "resultNote"='CONTENT_CHANGED', "updatedAt"=CURRENT_TIMESTAMP
     WHERE "packageId"=OLD."weeklyPackageId" AND "state"='PENDING';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ContentPlanItem_weekly_invalidation" AFTER UPDATE ON "ContentPlanItem"
 FOR EACH ROW EXECUTE FUNCTION invalidate_weekly_content_package();
