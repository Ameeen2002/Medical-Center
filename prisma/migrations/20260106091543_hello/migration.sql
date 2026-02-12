/*
  Warnings:

  - The `amount` column on the `Medicine` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Medicine" DROP COLUMN "amount",
ADD COLUMN     "amount" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
