import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string; passageId: string }> | { id: string; passageId: string } };
async function getParams(ctx: Context) { return await ctx.params; }

export async function PATCH(req: NextRequest, ctx: Context) {
  const { id, passageId } = await getParams(ctx);
  try {
    const body     = await req.json();
    const cellLine = await prisma.cellLine.findUnique({ where: { id }, select: { id: true } });
    if (!cellLine) return NextResponse.json({ error: "Cell line not found" }, { status: 404 });

    const updated = await prisma.cellLinePassage.update({
      where: { id: passageId },
      data: {
        passage:          body.passage   != null ? Number(body.passage)   : undefined,
        vialCount:        body.vialCount != null ? Number(body.vialCount) : undefined,
        freezeBackDate:   body.freezeBackDate  ? new Date(body.freezeBackDate)  : null,
        freezingSolution: body.freezingSolution?.trim() || null,
        frozenBy:         body.frozenBy?.trim()         || null,
        storageLocation:  body.storageLocation?.trim()  || null,
        notes:            body.notes?.trim()            || null,
        lowThresholdType:  body.lowThresholdType  || null,
        lowThresholdAmber: body.lowThresholdAmber != null ? Number(body.lowThresholdAmber) : null,
        lowThresholdRed:   body.lowThresholdRed   != null ? Number(body.lowThresholdRed)   : null,
      },
      include: { attachments: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH cell line passage failed:", error);
    return NextResponse.json({ error: "Failed to update passage" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Context) {
  const { id, passageId } = await getParams(ctx);
  const user = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const cellLine = await prisma.cellLine.findUnique({ where: { id }, select: { owner: true } });
    if (!cellLine) return NextResponse.json({ error: "Cell line not found" }, { status: 404 });
    if (cellLine.owner && cellLine.owner !== user && user !== "Admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.cellLinePassage.delete({ where: { id: passageId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE cell line passage failed:", error);
    return NextResponse.json({ error: "Failed to delete passage" }, { status: 500 });
  }
}
