-- CreateEnum
CREATE TYPE "bicycle_size" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "bicycle_status" AS ENUM ('archived', 'available', 'draft', 'hidden', 'maintenance', 'moderation', 'rejected', 'rented', 'reserved');

-- CreateTable
CREATE TABLE "bicycles" (
    "id" TEXT NOT NULL,
    "manufacturerProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "size" "bicycle_size" NOT NULL,
    "photoUrls" TEXT[],
    "pricePerDayKopecks" INTEGER NOT NULL,
    "depositKopecks" INTEGER NOT NULL,
    "status" "bicycle_status" NOT NULL DEFAULT 'draft',
    "moderationComment" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "region" TEXT,
    "city" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "deliveryAvailable" BOOLEAN NOT NULL DEFAULT false,
    "maxLoadKg" INTEGER NOT NULL,
    "seatHeightCm" INTEGER NOT NULL,
    "frameLengthCm" INTEGER NOT NULL,
    "wheelDiameterCm" INTEGER NOT NULL,
    "recommendedAnimalDimensions" TEXT NOT NULL,
    "safetyNotes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bicycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bicycles_manufacturerProfileId_createdAt_idx" ON "bicycles"("manufacturerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "bicycles_status_createdAt_idx" ON "bicycles"("status", "createdAt");

-- CreateIndex
CREATE INDEX "bicycles_size_idx" ON "bicycles"("size");

-- CreateIndex
CREATE INDEX "bicycles_city_idx" ON "bicycles"("city");

-- CreateIndex
CREATE INDEX "bicycles_pricePerDayKopecks_idx" ON "bicycles"("pricePerDayKopecks");

-- AddForeignKey
ALTER TABLE "bicycles" ADD CONSTRAINT "bicycles_manufacturerProfileId_fkey" FOREIGN KEY ("manufacturerProfileId") REFERENCES "manufacturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
