-- CreateEnum
CREATE TYPE "PackageTierLevel" AS ENUM ('BUDGET', 'MID_RANGE', 'PREMIUM', 'LUXURY');

-- CreateEnum
CREATE TYPE "MealPlan" AS ENUM ('EP', 'CP', 'MAP', 'AP');

-- CreateEnum
CREATE TYPE "InclusionType" AS ENUM ('INCLUSION', 'EXCLUSION');

-- CreateEnum
CREATE TYPE "PolicyKind" AS ENUM ('CANCELLATION', 'PAYMENT', 'CHILD', 'GENERAL');

-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('NEW', 'ROUTED', 'QUOTED', 'ACCEPTED', 'CLOSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteRoutingStatus" AS ENUM ('NOTIFIED', 'VIEWED', 'DECLINED', 'QUOTED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('SENT', 'WITHDRAWN', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TravellerType" AS ENUM ('SOLO', 'COUPLE', 'FAMILY', 'FRIENDS', 'BUSINESS');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('VERIFY_PHONE');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'AGENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Faq" ADD COLUMN     "packageId" UUID;

-- AlterTable
ALTER TABLE "MediaAttachment" ADD COLUMN     "packageId" UUID;

-- CreateTable
CREATE TABLE "Package" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "overview" TEXT,
    "durationDays" INTEGER NOT NULL,
    "durationNights" INTEGER NOT NULL,
    "startLocationId" UUID,
    "fromPrice" INTEGER,
    "priceBasis" TEXT NOT NULL DEFAULT 'PER_PERSON_TWIN_SHARING',
    "availableMonths" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "minPax" INTEGER NOT NULL DEFAULT 1,
    "maxPax" INTEGER,
    "isCustomizable" BOOLEAN NOT NULL DEFAULT true,
    "rating" DECIMAL(2,1),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "seoTitle" VARCHAR(70),
    "seoDescription" VARCHAR(170),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDestination" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "destinationId" UUID NOT NULL,
    "nights" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "PackageDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageTier" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "level" "PackageTierLevel" NOT NULL,
    "pricePerPerson" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "childPrice" INTEGER,
    "singleSupplement" INTEGER,
    "taxesIncluded" BOOLEAN NOT NULL DEFAULT false,
    "hotelCategory" INTEGER,
    "transportNote" TEXT,

    CONSTRAINT "PackageTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDay" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "overnightDestinationId" UUID,
    "mealsIncluded" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PackageDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDayPlace" (
    "packageDayId" UUID NOT NULL,
    "placeId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "PackageDayPlace_pkey" PRIMARY KEY ("packageDayId","placeId")
);

-- CreateTable
CREATE TABLE "PackageStay" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "tierLevel" "PackageTierLevel" NOT NULL,
    "destinationId" UUID NOT NULL,
    "nights" INTEGER NOT NULL,
    "hotelName" TEXT NOT NULL,
    "orSimilar" BOOLEAN NOT NULL DEFAULT true,
    "hotelCategory" INTEGER,
    "roomType" TEXT,
    "mealPlan" "MealPlan" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackageStay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageInclusion" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "type" "InclusionType" NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackageInclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagePolicy" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "kind" "PolicyKind" NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "PackagePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageTag" (
    "packageId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "PackageTag_pkey" PRIMARY KEY ("packageId","tagId")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT,
    "serviceStates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxOpenLeads" INTEGER NOT NULL DEFAULT 20,
    "lastRoutedAt" TIMESTAMP(3),
    "notes" TEXT,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "packageId" UUID,
    "packageTier" "PackageTierLevel",
    "destinationId" UUID,
    "departureLocationId" UUID,
    "startDate" DATE,
    "flexibleMonth" INTEGER,
    "nights" INTEGER NOT NULL,
    "adults" INTEGER NOT NULL,
    "childAges" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "rooms" INTEGER NOT NULL,
    "budgetPerPersonMin" INTEGER,
    "budgetPerPersonMax" INTEGER,
    "hotelCategory" INTEGER,
    "notes" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3) NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'NEW',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRequestAgent" (
    "quoteRequestId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "status" "QuoteRoutingStatus" NOT NULL DEFAULT 'NOTIFIED',
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "declineReason" TEXT,

    CONSTRAINT "QuoteRequestAgent_pkey" PRIMARY KEY ("quoteRequestId","agentId")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" UUID NOT NULL,
    "quoteRequestId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "tier" "PackageTierLevel",
    "totalPrice" INTEGER NOT NULL,
    "pricePerPerson" INTEGER NOT NULL,
    "taxesIncluded" BOOLEAN NOT NULL,
    "hotels" JSONB NOT NULL,
    "inclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "message" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'SENT',
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "packageId" UUID,
    "destinationId" UUID,
    "placeId" UUID,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(120),
    "body" TEXT NOT NULL,
    "travelledMonth" DATE,
    "travellerType" "TravellerType",
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "moderationNote" TEXT,
    "moderatedById" UUID,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Package_slug_key" ON "Package"("slug");

-- CreateIndex
CREATE INDEX "Package_status_fromPrice_idx" ON "Package"("status", "fromPrice");

-- CreateIndex
CREATE INDEX "Package_status_durationNights_idx" ON "Package"("status", "durationNights");

-- CreateIndex
CREATE INDEX "Package_status_popularityScore_idx" ON "Package"("status", "popularityScore");

-- CreateIndex
CREATE INDEX "PackageDestination_destinationId_idx" ON "PackageDestination"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageDestination_packageId_sortOrder_key" ON "PackageDestination"("packageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PackageTier_packageId_level_key" ON "PackageTier"("packageId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "PackageDay_packageId_dayNumber_key" ON "PackageDay"("packageId", "dayNumber");

-- CreateIndex
CREATE INDEX "PackageStay_packageId_tierLevel_sortOrder_idx" ON "PackageStay"("packageId", "tierLevel", "sortOrder");

-- CreateIndex
CREATE INDEX "PackageInclusion_packageId_type_sortOrder_idx" ON "PackageInclusion"("packageId", "type", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PackagePolicy_packageId_kind_key" ON "PackagePolicy"("packageId", "kind");

-- CreateIndex
CREATE INDEX "PackageTag_tagId_idx" ON "PackageTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_userId_key" ON "Agent"("userId");

-- CreateIndex
CREATE INDEX "Agent_isActive_lastRoutedAt_idx" ON "Agent"("isActive", "lastRoutedAt");

-- CreateIndex
CREATE INDEX "QuoteRequest_userId_createdAt_idx" ON "QuoteRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteRequest_status_createdAt_idx" ON "QuoteRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteRequestAgent_agentId_status_idx" ON "QuoteRequestAgent"("agentId", "status");

-- CreateIndex
CREATE INDEX "Quote_agentId_status_idx" ON "Quote"("agentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteRequestId_agentId_key" ON "Quote"("quoteRequestId", "agentId");

-- CreateIndex
CREATE INDEX "OtpChallenge_phone_purpose_createdAt_idx" ON "OtpChallenge"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "Review_packageId_status_createdAt_idx" ON "Review"("packageId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_destinationId_status_createdAt_idx" ON "Review"("destinationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_placeId_status_createdAt_idx" ON "Review"("placeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_packageId_key" ON "Review"("userId", "packageId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_destinationId_key" ON "Review"("userId", "destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_placeId_key" ON "Review"("userId", "placeId");

-- CreateIndex
CREATE INDEX "Faq_packageId_sortOrder_idx" ON "Faq"("packageId", "sortOrder");

-- CreateIndex
CREATE INDEX "MediaAttachment_packageId_sortOrder_idx" ON "MediaAttachment"("packageId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_startLocationId_fkey" FOREIGN KEY ("startLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDestination" ADD CONSTRAINT "PackageDestination_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDestination" ADD CONSTRAINT "PackageDestination_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTier" ADD CONSTRAINT "PackageTier_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDay" ADD CONSTRAINT "PackageDay_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDay" ADD CONSTRAINT "PackageDay_overnightDestinationId_fkey" FOREIGN KEY ("overnightDestinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDayPlace" ADD CONSTRAINT "PackageDayPlace_packageDayId_fkey" FOREIGN KEY ("packageDayId") REFERENCES "PackageDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDayPlace" ADD CONSTRAINT "PackageDayPlace_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageStay" ADD CONSTRAINT "PackageStay_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageStay" ADD CONSTRAINT "PackageStay_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageInclusion" ADD CONSTRAINT "PackageInclusion_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePolicy" ADD CONSTRAINT "PackagePolicy_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTag" ADD CONSTRAINT "PackageTag_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTag" ADD CONSTRAINT "PackageTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_departureLocationId_fkey" FOREIGN KEY ("departureLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequestAgent" ADD CONSTRAINT "QuoteRequestAgent_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequestAgent" ADD CONSTRAINT "QuoteRequestAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Single-owner rules now include packages.
ALTER TABLE "Faq" DROP CONSTRAINT "Faq_single_owner_chk";
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_single_owner_chk"
  CHECK (num_nonnulls("destinationId", "placeId", "packageId") = 1);
ALTER TABLE "MediaAttachment" DROP CONSTRAINT "MediaAttachment_single_owner_chk";
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_single_owner_chk"
  CHECK (num_nonnulls("destinationId", "placeId", "collectionId", "packageId") = 1);

-- Integrity rules Prisma cannot express.
ALTER TABLE "Review" ADD CONSTRAINT "Review_single_target_chk"
  CHECK (num_nonnulls("packageId", "destinationId", "placeId") = 1);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_chk" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Package" ADD CONSTRAINT "Package_duration_chk"
  CHECK ("durationNights" >= 0 AND "durationDays" BETWEEN 1 AND 60 AND "durationDays" >= "durationNights");
ALTER TABLE "PackageTier" ADD CONSTRAINT "PackageTier_price_chk"
  CHECK ("pricePerPerson" > 0 AND ("compareAtPrice" IS NULL OR "compareAtPrice" > "pricePerPerson"));
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_numbers_chk"
  CHECK ("adults" >= 1 AND "rooms" >= 1 AND "nights" >= 1
    AND ("flexibleMonth" IS NULL OR "flexibleMonth" BETWEEN 1 AND 12)
    AND ("startDate" IS NOT NULL OR "flexibleMonth" IS NOT NULL));
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_price_chk" CHECK ("totalPrice" > 0 AND "pricePerPerson" > 0);
