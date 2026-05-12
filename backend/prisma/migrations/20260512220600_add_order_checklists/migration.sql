-- CreateEnum
CREATE TYPE "order_checklist_type" AS ENUM ('issue', 'return');

-- CreateEnum
CREATE TYPE "order_checklist_condition" AS ENUM ('damaged', 'not_applicable', 'ok', 'unsafe', 'worn');

-- CreateEnum
CREATE TYPE "order_checklist_bicycle_action" AS ENUM ('hidden', 'maintenance', 'none');

-- CreateTable
CREATE TABLE "order_checklists" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "bicycleId" TEXT NOT NULL,
    "type" "order_checklist_type" NOT NULL,
    "frameCondition" "order_checklist_condition" NOT NULL,
    "wheelsCondition" "order_checklist_condition" NOT NULL,
    "handlebarCondition" "order_checklist_condition" NOT NULL,
    "saddleCondition" "order_checklist_condition" NOT NULL,
    "brakesCondition" "order_checklist_condition" NOT NULL,
    "exteriorCondition" "order_checklist_condition" NOT NULL,
    "safetyAction" "order_checklist_bicycle_action" NOT NULL DEFAULT 'none',
    "comment" TEXT,
    "checkedByUserId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_checklists_orderId_type_idx" ON "order_checklists"("orderId", "type");

-- CreateIndex
CREATE INDEX "order_checklists_bicycleId_type_checkedAt_idx" ON "order_checklists"("bicycleId", "type", "checkedAt");

-- CreateIndex
CREATE INDEX "order_checklists_checkedByUserId_checkedAt_idx" ON "order_checklists"("checkedByUserId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_checklists_orderId_bicycleId_type_key" ON "order_checklists"("orderId", "bicycleId", "type");

-- AddForeignKey
ALTER TABLE "order_checklists" ADD CONSTRAINT "order_checklists_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_checklists" ADD CONSTRAINT "order_checklists_bicycleId_fkey" FOREIGN KEY ("bicycleId") REFERENCES "bicycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_checklists" ADD CONSTRAINT "order_checklists_checkedByUserId_fkey" FOREIGN KEY ("checkedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
