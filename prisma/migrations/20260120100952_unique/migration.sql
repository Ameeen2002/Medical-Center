/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Medicine` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Medicine_name_key" ON "Medicine"("name");
