import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> | { id: string } };
async function getId(ctx: Context) { const p = await ctx.params; return p.id; }

export async function GET(_req: NextRequest, ctx: Context) {
  const id = await getId(ctx);
  try {
    const lots = await prisma.reagentLot.findMany({
      where: { reagentId: id },
      include: { attachments: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(lots);
  } catch (error) {
    console.error("GET reagent lots failed:", error);
    return NextResponse.json({ error: "Failed to load lots" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Context) {
  const id   = await getId(ctx);
  const user = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const body = await req.json();
    if (!body.quantity || body.quantity <= 0)
      return NextResponse.json({ error: "Quantity is required and must be > 0" }, { status: 400 });
    if (!body.unit?.trim())
      return NextResponse.json({ error: "Unit is required" }, { status: 400 });

    const reagent = await prisma.inventoryReagent.findUnique({ where: { id } });
    if (!reagent) return NextResponse.json({ error: "Reagent not found" }, { status: 404 });

    const lot = await prisma.reagentLot.create({
      data: {
        reagentId:       id,
        lotNumber:       body.lotNumber?.trim()     || null,
        quantity:        Number(body.quantity),
        unit:            body.unit.trim(),
        supplier:        body.supplier?.trim()      || null,
        catalogNumber:   body.catalogNumber?.trim() || null,
        expiryDate:      body.expiryDate   ? new Date(body.expiryDate)   : null,
        receivedDate:    body.receivedDate ? new Date(body.receivedDate) : null,
        receivedBy:      body.receivedBy?.trim()    || user,
        notes:           body.notes?.trim()         || null,
        lowThresholdType:  body.lowThresholdType  || null,
        lowThresholdAmber: body.lowThresholdAmber != null ? Number(body.lowThresholdAmber) : null,
        lowThresholdRed:   body.lowThresholdRed   != null ? Number(body.lowThresholdRed)   : null,
      },
      include: { attachments: true },
    });
    return NextResponse.json(lot, { status: 201 });
  } catch (error) {
    console.error("POST reagent lot failed:", error);
    return NextResponse.json({ error: "Failed to create lot" }, { status: 500 });
  }
}
