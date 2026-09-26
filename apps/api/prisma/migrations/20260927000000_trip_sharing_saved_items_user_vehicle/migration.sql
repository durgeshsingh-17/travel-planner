-- CreateEnum
CREATE TYPE "TripVisibility" AS ENUM ('PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "SavedItemType" AS ENUM ('TRIP');

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "shareSlug" TEXT,
ADD COLUMN     "userVehicleId" UUID,
ADD COLUMN     "visibility" "TripVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "SavedItemType" NOT NULL,
    "tripId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedItem_userId_type_createdAt_idx" ON "SavedItem"("userId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_tripId_key" ON "SavedItem"("userId", "tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_shareSlug_key" ON "Trip"("shareSlug");

-- CreateIndex
CREATE INDEX "Trip_userVehicleId_idx" ON "Trip"("userVehicleId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userVehicleId_fkey" FOREIGN KEY ("userVehicleId") REFERENCES "UserVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: link existing trips to the owner's saved vehicle when exactly one
-- garage entry matches the catalog vehicle, so custom mileage applies.
UPDATE "Trip" t
SET "userVehicleId" = uv."id"
FROM "UserVehicle" uv
WHERE t."userVehicleId" IS NULL
  AND t."vehicleId" = uv."vehicleId"
  AND t."userId" = uv."userId"
  AND (
    SELECT COUNT(*) FROM "UserVehicle" uv2
    WHERE uv2."userId" = t."userId" AND uv2."vehicleId" = t."vehicleId"
  ) = 1;
