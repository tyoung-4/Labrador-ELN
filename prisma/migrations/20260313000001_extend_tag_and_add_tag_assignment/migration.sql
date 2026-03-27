-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('PROJECT', 'GENERAL');

-- AlterTable: add new columns to Tag with defaults (fully backward-compatible)
ALTER TABLE "Tag"
  ADD COLUMN "type"      "TagType"  NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "color"     TEXT       NOT NULL DEFAULT '#6366f1',
  ADD COLUMN "createdBy" TEXT       NOT NULL DEFAULT 'Admin',
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable: TagAssignment (polymorphic assignment table)
CREATE TABLE "TagAssignment" (
  "id"         TEXT NOT NULL,
  "tagId"      TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT NOT NULL,
  "assignedBy" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_entityType_entityId_key"
  ON "TagAssignment"("tagId", "entityType", "entityId");

CREATE INDEX "TagAssignment_entityType_entityId_idx"
  ON "TagAssignment"("entityType", "entityId");

CREATE INDEX "TagAssignment_tagId_idx"
  ON "TagAssignment"("tagId");

-- AddForeignKey
ALTER TABLE "TagAssignment"
  ADD CONSTRAINT "TagAssignment_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
