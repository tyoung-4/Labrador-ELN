-- CreateTable
CREATE TABLE "EquipmentBooking" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentBooking_equipmentId_startTime_endTime_idx" ON "EquipmentBooking"("equipmentId", "startTime", "endTime");
