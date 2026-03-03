-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntryType" ADD VALUE 'CELL_LINE';
ALTER TYPE "EntryType" ADD VALUE 'PROTEIN';
ALTER TYPE "EntryType" ADD VALUE 'REAGENT';
ALTER TYPE "EntryType" ADD VALUE 'CHROMATOGRAPHY_RUN';

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "linkedRunId" TEXT;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_linkedRunId_fkey" FOREIGN KEY ("linkedRunId") REFERENCES "ProtocolRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
