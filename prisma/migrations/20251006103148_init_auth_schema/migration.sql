/*
  Warnings:

  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissionValue" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "roles" TEXT[] DEFAULT ARRAY['user']::TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
