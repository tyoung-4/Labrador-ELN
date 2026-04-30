import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string; lotId: string }> | { id: string; lotId: string } };
async function getParams(ctx: Context) { return await ctx.params; }

export async function PATCH(req: NextRequest, ctx: Context) {
  const { id, lotId } = await getParams(ctx);
  const user = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const body = await req.json();
    const reagent = await prisma.inventoryReagent.findUnique({ where: { id }, select: { owner: true } });
    if (!reagent) return NextResponse.json({ error: "Reagent not found" }, { status: 404 });
    if (reagent.owner && reagent.owner !== user && user !== "Admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await prisma.reagentLot.update({
      where: { id: lotId },
      data: {
        lotNumber:       body.lotNumber?.trim()     || null,
        quantity:        body.quantity != null ? Number(body.quantity) : undefined,
        unit:            body.unit?.trim()           || undefined,
        supplier:        body.supplier?.trim()      || null,
        catalogNumber:   body.catalogNumber?.trim() || null,
        expiryDate:      body.expiryDate   ? new Date(body.expiryDate)   : null,
        receivedDate:    body.receivedDate ? new Date(body.receivedDate) : null,
        receivedBy:      body.receivedBy?.trim()    || null,
        notes:           body.notes?.trim()         || null,
        lowThresholdType:  body.lowThresholdType  || null,
        lowThresholdAmber: body.lowThresholdAmber != null ? Number(body.lowThresholdAmber) : null,
        lowThresholdRed:   body.lowThresholdRed   != null ? Number(body.lowThresholdRed)   : null,
      },
      include: { attachments: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH reagent lot failed:", error);
    return NextResponse.json({ error: "Failed to update lot" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Context) {
  const { id, lotId } = await getParams(ctx);
  const user = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const reagent = await prisma.inventoryReagent.findUnique({ where: { id }, select: { owner: true } });
    if (!reagent) return NextResponse.json({ error: "Reagent not found" }, { status: 404 });
    if (reagent.owner && reagent.owner !== user && user !== "Admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.reagentLot.delete({ where: { id: lotId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE reagent lot failed:", error);
    return NextResponse.json({ error: "Failed to delete lot" }, { status: 500 });
  }
}
