import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { equipmentLabel } from "@/lib/equipmentNames";

/**
 * GET /api/equipment/recent-releases
 * Returns bookings that were ended early within the last 2 minutes.
 * Polled by equipment calendars every 30 s to surface toast notifications.
 */
export async function GET() {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const releases = await prisma.equipmentBooking.findMany({
      where: { endedEarlyAt: { gte: twoMinutesAgo } },
      orderBy: { endedEarlyAt: "desc" },
    });

    return NextResponse.json(
      releases.map(b => ({
        id:            b.id,
        equipmentId:   b.equipmentId,
        equipmentName: equipmentLabel(b.equipmentId),
        operatorName:  b.operatorName,
        endedEarlyAt:  b.endedEarlyAt!.toISOString(),
      }))
    );
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
