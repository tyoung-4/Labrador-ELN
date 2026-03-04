import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { ScheduleEvent, ResourceId } from "@/components/EquipmentShared";
import { equipmentLabel } from "@/lib/equipmentNames";

type DbBooking = {
  id: string;
  equipmentId: string;
  operatorName: string;
  userId: string;
  title: string;
  startTime: Date;
  endTime: Date;
};

function toEvent(b: DbBooking): ScheduleEvent {
  const s = b.startTime;
  const e = b.endTime;
  return {
    id:         b.id,
    resourceId: b.equipmentId as ResourceId,
    date:       `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`,
    startTime:  `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`,
    endTime:    `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`,
    title:      b.title,
    userId:     b.userId,
    userName:   b.operatorName,
  };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { equipmentId, operatorName, userId, startTime, endTime, title } = await req.json();

    if (!equipmentId || !operatorName || !userId || !startTime || !endTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const start = new Date(startTime);
    const end   = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
    }

    // Conflict check excluding the booking being updated
    const conflict = await prisma.equipmentBooking.findFirst({
      where: {
        equipmentId,
        id:        { not: id },
        startTime: { lt: end },
        endTime:   { gt: start },
      },
    });

    if (conflict) {
      const name = equipmentLabel(equipmentId);
      return NextResponse.json(
        { error: `${name} is already booked by ${conflict.operatorName} at this time` },
        { status: 409 }
      );
    }

    const booking = await prisma.equipmentBooking.update({
      where: { id },
      data: {
        equipmentId,
        operatorName: String(operatorName),
        userId:       String(userId),
        title:        String(title ?? ""),
        startTime:    start,
        endTime:      end,
      },
    });

    return NextResponse.json(toEvent(booking));
  } catch (error) {
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to update booking", detail }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.equipmentBooking.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to delete booking", detail }, { status: 500 });
  }
}
