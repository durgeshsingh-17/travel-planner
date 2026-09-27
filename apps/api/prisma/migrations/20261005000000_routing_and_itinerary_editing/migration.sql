-- CreateEnum
CREATE TYPE "PlanCoverage" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "costAssumptions" JSONB,
ADD COLUMN     "coverage" "PlanCoverage",
ADD COLUMN     "destinationId" UUID,
ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "generatorVersion" TEXT,
ADD COLUMN     "maxDriveHoursPerDay" INTEGER,
ADD COLUMN     "pace" "TravelPace" NOT NULL DEFAULT 'BALANCED',
ADD COLUMN     "routePolyline" TEXT,
ADD COLUMN     "routeProvider" TEXT;

-- AlterTable
ALTER TABLE "TripDay" ADD COLUMN     "overnightLocation" TEXT;

-- AlterTable
ALTER TABLE "TripActivity" ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "isUserEdited" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RouteCache" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "distanceKm" DECIMAL(10,2) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "polyline" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteCache_key_key" ON "RouteCache"("key");

-- CreateIndex
CREATE INDEX "RouteCache_createdAt_idx" ON "RouteCache"("createdAt");

-- CreateIndex
CREATE INDEX "Trip_destinationId_idx" ON "Trip"("destinationId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

