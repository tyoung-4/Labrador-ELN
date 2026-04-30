-- AlterTable: add useParentThreshold + threshold fields to CellLine
ALTER TABLE "CellLine"
  ADD COLUMN "lowThresholdAmber" DOUBLE PRECISION,
  ADD COLUMN "lowThresholdRed" DOUBLE PRECISION,
  ADD COLUMN "lowThresholdType" TEXT,
  ADD COLUMN "useParentThreshold" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: add useParentThreshold to InventoryReagent
ALTER TABLE "InventoryReagent"
  ADD COLUMN "useParentThreshold" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: add useParentThreshold + threshold fields to Plasmid
ALTER TABLE "Plasmid"
  ADD COLUMN "lowThresholdAmber" DOUBLE PRECISION,
  ADD COLUMN "lowThresholdRed" DOUBLE PRECISION,
  ADD COLUMN "lowThresholdType" TEXT,
  ADD COLUMN "useParentThreshold" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: add useParentThreshold to ProteinStock
ALTER TABLE "ProteinStock"
  ADD COLUMN "useParentThreshold" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: ReagentLot
CREATE TABLE "ReagentLot" (
    "id" TEXT NOT NULL,
    "reagentId" TEXT NOT NULL,
    "lotNumber" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "supplier" TEXT,
    "catalogNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "receivedBy" TEXT,
    "notes" TEXT,
    "lowThresholdType" TEXT,
    "lowThresholdAmber" DOUBLE PRECISION,
    "lowThresholdRed" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReagentLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CellLinePassage
CREATE TABLE "CellLinePassage" (
    "id" TEXT NOT NULL,
    "cellLineId" TEXT NOT NULL,
    "passage" INTEGER,
    "vialCount" INTEGER,
    "freezeBackDate" TIMESTAMP(3),
    "freezingSolution" TEXT,
    "frozenBy" TEXT,
    "storageLocation" TEXT,
    "notes" TEXT,
    "lowThresholdType" TEXT,
    "lowThresholdAmber" DOUBLE PRECISION,
    "lowThresholdRed" DOUBLE PRECISION,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CellLinePassage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlasmidPrep
CREATE TABLE "PlasmidPrep" (
    "id" TEXT NOT NULL,
    "plasmidId" TEXT NOT NULL,
    "prepDate" TIMESTAMP(3),
    "prepType" TEXT,
    "concentration" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "preparedBy" TEXT,
    "sequenceVerified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lowThresholdType" TEXT,
    "lowThresholdAmber" DOUBLE PRECISION,
    "lowThresholdRed" DOUBLE PRECISION,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlasmidPrep_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InventoryAttachment
CREATE TABLE "InventoryAttachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "reagentLotId" TEXT,
    "cellLinePassageId" TEXT,
    "plasmidPrepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReagentLot_reagentId_idx" ON "ReagentLot"("reagentId");
CREATE INDEX "CellLinePassage_cellLineId_idx" ON "CellLinePassage"("cellLineId");
CREATE INDEX "PlasmidPrep_plasmidId_idx" ON "PlasmidPrep"("plasmidId");
CREATE INDEX "InventoryAttachment_reagentLotId_idx" ON "InventoryAttachment"("reagentLotId");
CREATE INDEX "InventoryAttachment_cellLinePassageId_idx" ON "InventoryAttachment"("cellLinePassageId");
CREATE INDEX "InventoryAttachment_plasmidPrepId_idx" ON "InventoryAttachment"("plasmidPrepId");

-- AddForeignKey
ALTER TABLE "ReagentLot" ADD CONSTRAINT "ReagentLot_reagentId_fkey"
  FOREIGN KEY ("reagentId") REFERENCES "InventoryReagent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CellLinePassage" ADD CONSTRAINT "CellLinePassage_cellLineId_fkey"
  FOREIGN KEY ("cellLineId") REFERENCES "CellLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlasmidPrep" ADD CONSTRAINT "PlasmidPrep_plasmidId_fkey"
  FOREIGN KEY ("plasmidId") REFERENCES "Plasmid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAttachment" ADD CONSTRAINT "InventoryAttachment_reagentLotId_fkey"
  FOREIGN KEY ("reagentLotId") REFERENCES "ReagentLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAttachment" ADD CONSTRAINT "InventoryAttachment_cellLinePassageId_fkey"
  FOREIGN KEY ("cellLinePassageId") REFERENCES "CellLinePassage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAttachment" ADD CONSTRAINT "InventoryAttachment_plasmidPrepId_fkey"
  FOREIGN KEY ("plasmidPrepId") REFERENCES "PlasmidPrep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
