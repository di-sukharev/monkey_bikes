/*
  Warnings:

  - Added the required column `bicycleCitySnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bicycleDeliveryAvailableSnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bicyclePickupAddressSnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bicycleSizeSnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bicycleTitleSnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `manufacturerCitySnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `manufacturerProfileIdSnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `manufacturerPublicNameSnapshot` to the `order_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "bicycleCitySnapshot" TEXT NOT NULL,
ADD COLUMN     "bicycleDeliveryAvailableSnapshot" BOOLEAN NOT NULL,
ADD COLUMN     "bicyclePickupAddressSnapshot" TEXT NOT NULL,
ADD COLUMN     "bicycleSizeSnapshot" "bicycle_size" NOT NULL,
ADD COLUMN     "bicycleTitleSnapshot" TEXT NOT NULL,
ADD COLUMN     "manufacturerCitySnapshot" TEXT NOT NULL,
ADD COLUMN     "manufacturerProfileIdSnapshot" TEXT NOT NULL,
ADD COLUMN     "manufacturerPublicNameSnapshot" TEXT NOT NULL,
ADD COLUMN     "manufacturerRegionSnapshot" TEXT;
