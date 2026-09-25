CREATE TYPE "TravellerGender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY');

CREATE TABLE "TripTraveller" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "TravellerGender" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripTraveller_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TripTraveller_tripId_idx" ON "TripTraveller"("tripId");

ALTER TABLE "TripTraveller" ADD CONSTRAINT "TripTraveller_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
