-- AlterTable
ALTER TABLE "CellLine" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastEditedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedBy" TEXT,
ADD COLUMN     "markedAt" TIMESTAMP(3),
ADD COLUMN     "markedBy" TEXT,
ADD COLUMN     "markedForArchive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "markedNote" TEXT;

-- AlterTable
ALTER TABLE "InventoryReagent" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastEditedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedBy" TEXT,
ADD COLUMN     "markedAt" TIMESTAMP(3),
ADD COLUMN     "markedBy" TEXT,
ADD COLUMN     "markedForArchive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "markedNote" TEXT;

-- AlterTable
ALTER TABLE "Plasmid" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastEditedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedBy" TEXT,
ADD COLUMN     "markedAt" TIMESTAMP(3),
ADD COLUMN     "markedBy" TEXT,
ADD COLUMN     "markedForArchive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "markedNote" TEXT;

-- AlterTable
ALTER TABLE "ProteinStock" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastEditedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedBy" TEXT,
ADD COLUMN     "markedAt" TIMESTAMP(3),
ADD COLUMN     "markedBy" TEXT,
ADD COLUMN     "markedForArchive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "markedNote" TEXT;

-- CreateTable
CREATE TABLE "InventoryEditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "editedBy" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "warningShown" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InventoryEditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ARCHIVE_REQUEST',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fromUser" TEXT NOT NULL,
    "note" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "DashboardNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryEditLog_entityType_entityId_idx" ON "InventoryEditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "InventoryEditLog_editedBy_idx" ON "InventoryEditLog"("editedBy");

-- CreateIndex
CREATE INDEX "InventoryEditLog_editedAt_idx" ON "InventoryEditLog"("editedAt");

-- CreateIndex
CREATE INDEX "DashboardNotification_userId_isRead_idx" ON "DashboardNotification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "DashboardNotification_userId_idx" ON "DashboardNotification"("userId");

-- CreateIndex
CREATE INDEX "DashboardNotification_createdAt_idx" ON "DashboardNotification"("createdAt");
