-- CreateEnum
CREATE TYPE "fulfillment_type" AS ENUM ('delivery', 'pickup');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('cancelled', 'confirmed', 'issued', 'request', 'returned');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'request',
    "startsOn" TEXT NOT NULL,
    "endsOn" TEXT NOT NULL,
    "rentalDays" INTEGER NOT NULL,
    "fulfillmentType" "fulfillment_type" NOT NULL,
    "deliveryAddress" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "userComment" TEXT,
    "adminComment" TEXT,
    "rentalAmountKopecks" INTEGER NOT NULL,
    "depositAmountKopecks" INTEGER NOT NULL,
    "deliveryAmountKopecks" INTEGER NOT NULL DEFAULT 0,
    "totalAmountKopecks" INTEGER NOT NULL,
    "safetyAgreementAcceptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "bicycleId" TEXT NOT NULL,
    "pricePerDaySnapshotKopecks" INTEGER NOT NULL,
    "depositSnapshotKopecks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_startsOn_endsOn_idx" ON "orders"("startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "order_items_bicycleId_idx" ON "order_items"("bicycleId");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_orderId_bicycleId_key" ON "order_items"("orderId", "bicycleId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_bicycleId_fkey" FOREIGN KEY ("bicycleId") REFERENCES "bicycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
