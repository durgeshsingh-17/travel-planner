-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('BIKE', 'CAR', 'EV');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "PlaceCategory" AS ENUM ('ATTRACTION', 'FOOD', 'CAFE', 'HOTEL', 'VIEWPOINT', 'FUEL', 'HOSPITAL', 'MECHANIC', 'PARKING', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "TravelMode" AS ENUM ('BIKE', 'CAR', 'BUS', 'FLIGHT');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'GENERATED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripActivityType" AS ENUM ('TRAVEL', 'MEAL', 'SIGHTSEEING', 'CHECK_IN', 'CHECK_OUT', 'BREAK', 'ACTIVITY');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "engineCc" INTEGER,
    "tankCapacity" DOUBLE PRECISION,
    "averageMileage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVehicle" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "nickname" TEXT,
    "customMileage" DOUBLE PRECISION,
    "registrationNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "heroImageUrl" TEXT,
    "bestTimeToVisit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" UUID NOT NULL,
    "destinationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "PlaceCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "averageVisitMinutes" INTEGER,
    "estimatedCost" DECIMAL(10,2),
    "openingTime" TEXT,
    "closingTime" TEXT,
    "rating" DECIMAL(2,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "title" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceLatitude" DECIMAL(9,6) NOT NULL,
    "sourceLongitude" DECIMAL(9,6) NOT NULL,
    "destinationName" TEXT NOT NULL,
    "destinationLatitude" DECIMAL(9,6) NOT NULL,
    "destinationLongitude" DECIMAL(9,6) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "travellerCount" INTEGER NOT NULL,
    "travelMode" "TravelMode" NOT NULL,
    "budget" DECIMAL(10,2),
    "vehicleId" UUID,
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "estimatedDistanceKm" DECIMAL(10,2),
    "estimatedDurationMinutes" INTEGER,
    "estimatedTotalCost" DECIMAL(10,2),
    "estimatedFuelCost" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripDay" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedDistanceKm" DECIMAL(10,2),
    "estimatedCost" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripActivity" (
    "id" UUID NOT NULL,
    "tripDayId" UUID NOT NULL,
    "placeId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "activityType" "TripActivityType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "estimatedCost" DECIMAL(10,2),
    "distanceFromPreviousKm" DECIMAL(10,2),
    "travelTimeFromPreviousMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserVehicle_userId_idx" ON "UserVehicle"("userId");

-- CreateIndex
CREATE INDEX "UserVehicle_vehicleId_idx" ON "UserVehicle"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");

-- CreateIndex
CREATE INDEX "Place_destinationId_idx" ON "Place"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_destinationId_slug_key" ON "Place"("destinationId", "slug");

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE INDEX "Trip_vehicleId_idx" ON "Trip"("vehicleId");

-- CreateIndex
CREATE INDEX "TripDay_tripId_idx" ON "TripDay"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TripDay_tripId_dayNumber_key" ON "TripDay"("tripId", "dayNumber");

-- CreateIndex
CREATE INDEX "TripActivity_tripDayId_idx" ON "TripActivity"("tripDayId");

-- CreateIndex
CREATE INDEX "TripActivity_placeId_idx" ON "TripActivity"("placeId");

-- AddForeignKey
ALTER TABLE "UserVehicle" ADD CONSTRAINT "UserVehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVehicle" ADD CONSTRAINT "UserVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripDay" ADD CONSTRAINT "TripDay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripActivity" ADD CONSTRAINT "TripActivity_tripDayId_fkey" FOREIGN KEY ("tripDayId") REFERENCES "TripDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripActivity" ADD CONSTRAINT "TripActivity_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
