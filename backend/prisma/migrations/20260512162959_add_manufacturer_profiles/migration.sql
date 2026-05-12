-- CreateEnum
CREATE TYPE "manufacturer_profile_status" AS ENUM ('approved', 'blocked', 'draft', 'moderation', 'rejected');

-- CreateTable
CREATE TABLE "manufacturer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "manufacturer_profile_status" NOT NULL DEFAULT 'draft',
    "moderationComment" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturer_profiles_userId_key" ON "manufacturer_profiles"("userId");

-- CreateIndex
CREATE INDEX "manufacturer_profiles_status_idx" ON "manufacturer_profiles"("status");

-- CreateIndex
CREATE INDEX "manufacturer_profiles_createdAt_idx" ON "manufacturer_profiles"("createdAt");

-- AddForeignKey
ALTER TABLE "manufacturer_profiles" ADD CONSTRAINT "manufacturer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
