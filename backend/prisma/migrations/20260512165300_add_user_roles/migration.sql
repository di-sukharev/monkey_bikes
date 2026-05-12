-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'manufacturer', 'user');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'blocked');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "user_role" NOT NULL DEFAULT 'user',
ADD COLUMN     "status" "user_status" NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");
