-- CreateEnum
CREATE TYPE "payment_type" AS ENUM ('deposit', 'rent');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('stub');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('cancelled', 'failed', 'pending', 'succeeded');

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "payment_type" NOT NULL,
    "provider" "payment_provider" NOT NULL DEFAULT 'stub',
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "amountKopecks" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "providerPaymentId" TEXT,
    "failureReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerPaymentId_key" ON "payments"("providerPaymentId");

-- CreateIndex
CREATE INDEX "payments_orderId_type_status_idx" ON "payments"("orderId", "type", "status");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderId_type_activeKey_key" ON "payments"("orderId", "type", "activeKey");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
