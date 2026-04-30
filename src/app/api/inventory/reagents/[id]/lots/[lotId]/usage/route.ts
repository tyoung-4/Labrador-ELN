import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string; lotId: string }> | { id: string; lotId: string } };
async function getParams(ctx: Context) { return await ctx.params; }

export async function POST(req: NextRequest, ctx: Context) {
  const { id, lotId } = await getParams(ctx);
  const user = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const { volumeUsed, usedBy, notes, date } = await req.json();
    if (!volumeUsed || volumeUsed <= 0)
      return NextResponse.json({ error: "volumeUsed must be > 0" }, { status: 400 });

    const reagent = await prisma.inventoryReagent.findUnique({ where: { id }, select: { id: true } });
    if (!reagent) return NextResponse.json({ error: "Reagent not found" }, { status: 404 });

    const event = await prisma.reagentUsageEvent.create({
      data: {
        reagentId:    id,
        reagentLotId: lotId,
        amountUsed:   Number(volumeUsed),
        usedBy:       usedBy?.trim() || user,
        date:         date ? new Date(date) : new Date(),
        notes:        notes?.trim() || null,
      },
    });
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("POST reagent lot usage failed:", error);
    return NextResponse.json({ error: "Failed to log usage" }, { status: 500 });
  }
}
