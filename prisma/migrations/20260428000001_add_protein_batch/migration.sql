-- CreateTable
CREATE TABLE "ProteinBatch" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "purificationDate" TIMESTAMP(3) NOT NULL,
    "initialVolume" DOUBLE PRECISION NOT NULL,
    "currentVolume" DOUBLE PRECISION NOT NULL,
    "concentration" DOUBLE PRECISION,
    "mw" DOUBLE PRECISION,
    "extinctionCoeff" DOUBLE PRECISION,
    "a280" DOUBLE PRECISION,
    "storageBuffer" TEXT,
    "storageLocationText" TEXT,
    "lowThresholdType" TEXT,
    "lowThresholdAmber" DOUBLE PRECISION,
    "lowThresholdRed" DOUBLE PRECISION,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProteinBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProteinBatch_batchId_key" ON "ProteinBatch"("batchId");

-- CreateIndex
CREATE INDEX "ProteinBatch_stockId_idx" ON "ProteinBatch"("stockId");

-- AddForeignKey
ALTER TABLE "ProteinBatch" ADD CONSTRAINT "ProteinBatch_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "ProteinStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

