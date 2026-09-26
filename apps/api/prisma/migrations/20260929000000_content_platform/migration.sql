-- Trigram search for destination, place and location names.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('THEME', 'ACTIVITY', 'AUDIENCE', 'SEASON');

-- CreateEnum
CREATE TYPE "MonthRating" AS ENUM ('GOOD', 'OK', 'AVOID');

-- CreateEnum
CREATE TYPE "ReachMode" AS ENUM ('ROAD', 'TRAIN', 'AIR', 'BUS');

-- AlterTable
ALTER TABLE "Destination" ADD COLUMN     "altitudeM" INTEGER,
ADD COLUMN     "budgetPerDayMax" INTEGER,
ADD COLUMN     "budgetPerDayMin" INTEGER,
ADD COLUMN     "idealDaysMax" INTEGER,
ADD COLUMN     "idealDaysMin" INTEGER,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nearestAirport" TEXT,
ADD COLUMN     "nearestAirportKm" INTEGER,
ADD COLUMN     "nearestRailway" TEXT,
ADD COLUMN     "nearestRailwayKm" INTEGER,
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "popularityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "rating" DECIMAL(2,1),
ADD COLUMN     "seoDescription" VARCHAR(170),
ADD COLUMN     "seoTitle" VARCHAR(70),
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "tagline" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "popularity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bestTimeOfDay" TEXT,
ADD COLUMN     "entryFeeChild" DECIMAL(10,2),
ADD COLUMN     "entryFeeForeigner" DECIMAL(10,2),
ADD COLUMN     "entryFeeIndian" DECIMAL(10,2),
ADD COLUMN     "feeNotes" TEXT,
ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "rankInDestination" INTEGER,
ADD COLUMN     "seoDescription" VARCHAR(170),
ADD COLUMN     "seoTitle" VARCHAR(70),
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "timeRequiredMaxMinutes" INTEGER,
ADD COLUMN     "timeRequiredMinMinutes" INTEGER,
ADD COLUMN     "tips" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PlaceTiming" (
    "id" UUID NOT NULL,
    "placeId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlaceTiming_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TagKind" NOT NULL DEFAULT 'THEME',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestinationTag" (
    "destinationId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "DestinationTag_pkey" PRIMARY KEY ("destinationId","tagId")
);

-- CreateTable
CREATE TABLE "PlaceTag" (
    "placeId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "PlaceTag_pkey" PRIMARY KEY ("placeId","tagId")
);

-- CreateTable
CREATE TABLE "DestinationMonthInfo" (
    "id" UUID NOT NULL,
    "destinationId" UUID NOT NULL,
    "month" INTEGER NOT NULL,
    "rating" "MonthRating" NOT NULL,
    "avgMinC" INTEGER,
    "avgMaxC" INTEGER,
    "rainfallMm" INTEGER,
    "notes" TEXT,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "DestinationMonthInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HowToReach" (
    "id" UUID NOT NULL,
    "destinationId" UUID NOT NULL,
    "mode" "ReachMode" NOT NULL,
    "hubName" TEXT NOT NULL,
    "distanceKm" INTEGER,
    "durationMinutes" INTEGER,
    "costMin" INTEGER,
    "costMax" INTEGER,
    "summary" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HowToReach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" UUID NOT NULL,
    "destinationId" UUID,
    "placeId" UUID,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "body" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "seoTitle" VARCHAR(70),
    "seoDescription" VARCHAR(170),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "destinationId" UUID,
    "placeId" UUID,
    "blurb" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" UUID NOT NULL,
    "storageKey" TEXT,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "altText" TEXT NOT NULL,
    "credit" TEXT,
    "license" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAttachment" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "destinationId" UUID,
    "placeId" UUID,
    "collectionId" UUID,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MediaAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlugRedirect" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "fromSlug" TEXT NOT NULL,
    "toSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceTiming_placeId_dayOfWeek_key" ON "PlaceTiming"("placeId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "DestinationTag_tagId_idx" ON "DestinationTag"("tagId");

-- CreateIndex
CREATE INDEX "PlaceTag_tagId_idx" ON "PlaceTag"("tagId");

-- CreateIndex
CREATE INDEX "DestinationMonthInfo_month_rating_idx" ON "DestinationMonthInfo"("month", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "DestinationMonthInfo_destinationId_month_key" ON "DestinationMonthInfo"("destinationId", "month");

-- CreateIndex
CREATE INDEX "HowToReach_destinationId_sortOrder_idx" ON "HowToReach"("destinationId", "sortOrder");

-- CreateIndex
CREATE INDEX "Faq_destinationId_sortOrder_idx" ON "Faq"("destinationId", "sortOrder");

-- CreateIndex
CREATE INDEX "Faq_placeId_sortOrder_idx" ON "Faq"("placeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_status_isFeatured_idx" ON "Collection"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_sortOrder_idx" ON "CollectionItem"("collectionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Media_storageKey_key" ON "Media"("storageKey");

-- CreateIndex
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");

-- CreateIndex
CREATE INDEX "MediaAttachment_mediaId_idx" ON "MediaAttachment"("mediaId");

-- CreateIndex
CREATE INDEX "MediaAttachment_destinationId_sortOrder_idx" ON "MediaAttachment"("destinationId", "sortOrder");

-- CreateIndex
CREATE INDEX "MediaAttachment_placeId_sortOrder_idx" ON "MediaAttachment"("placeId", "sortOrder");

-- CreateIndex
CREATE INDEX "MediaAttachment_collectionId_sortOrder_idx" ON "MediaAttachment"("collectionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SlugRedirect_entityType_scope_fromSlug_key" ON "SlugRedirect"("entityType", "scope", "fromSlug");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Destination_status_state_idx" ON "Destination"("status", "state");

-- CreateIndex
CREATE INDEX "Destination_status_popularityScore_idx" ON "Destination"("status", "popularityScore");

-- CreateIndex
CREATE INDEX "Destination_name_trgm_idx" ON "Destination" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Location_name_trgm_idx" ON "Location" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Place_destinationId_status_rankInDestination_idx" ON "Place"("destinationId", "status", "rankInDestination");

-- CreateIndex
CREATE INDEX "Place_name_trgm_idx" ON "Place" USING GIN ("name" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "PlaceTiming" ADD CONSTRAINT "PlaceTiming_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestinationTag" ADD CONSTRAINT "DestinationTag_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestinationTag" ADD CONSTRAINT "DestinationTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceTag" ADD CONSTRAINT "PlaceTag_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceTag" ADD CONSTRAINT "PlaceTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestinationMonthInfo" ADD CONSTRAINT "DestinationMonthInfo_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HowToReach" ADD CONSTRAINT "HowToReach_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Content that already existed was live before publishing was introduced; keep it visible.
UPDATE "Destination" SET "status" = 'PUBLISHED', "publishedAt" = NOW() WHERE "status" = 'DRAFT';
UPDATE "Place" SET "status" = 'PUBLISHED', "publishedAt" = NOW() WHERE "status" = 'DRAFT';

-- "Gurgaon" is an alias of Gurugram, not a separate place.
UPDATE "Location" SET "aliases" = ARRAY['Gurgaon'] WHERE "slug" = 'gurugram';
UPDATE "Location" SET "isActive" = false WHERE "slug" = 'gurgaon';

-- Integrity rules Prisma cannot express.
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_single_owner_chk"
  CHECK (num_nonnulls("destinationId", "placeId") = 1);
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_single_target_chk"
  CHECK (num_nonnulls("destinationId", "placeId") = 1);
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_single_owner_chk"
  CHECK (num_nonnulls("destinationId", "placeId", "collectionId") = 1);
ALTER TABLE "DestinationMonthInfo" ADD CONSTRAINT "DestinationMonthInfo_month_chk"
  CHECK ("month" BETWEEN 1 AND 12);
ALTER TABLE "PlaceTiming" ADD CONSTRAINT "PlaceTiming_day_chk"
  CHECK ("dayOfWeek" BETWEEN 0 AND 6);
