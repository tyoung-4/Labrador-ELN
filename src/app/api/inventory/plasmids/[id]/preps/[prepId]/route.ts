import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string; prepId: string }> | { id: string; prepId: string } };
async function getParams(ctx: Context) { return await ctx.params; }

export async function PATCH(req: NextRequest, ctx: Context) {
  const { id, prepId } = await getParams(ctx);
  const user = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const body    = await req.json();
    const plasmid = await prisma.plasmid.findUnique({ where: { id }, select: { owner: true } });
    if (!plasmid) return NextResponse.json({ error: "Plasmid not found" }, { status: 404 });
    if (plasmid.owner && plasmid.owner !== user && user !== "Admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await prisma.plasmidPrep.update({
      where: { id: prepId },
      data: {
        prepDate:         body.prepDate ? new Date(body.prepDate) : null,
        prepType:         body.prepType?.trim()    || null,
        concentration:    body.concentration != null ? Number(body.concentration) : null,
        volume:           body.volume        != null ? Number(body.volume)        : null,
        preparedBy:       body.preparedBy?.trim()  || null,
        sequenceVerified: body.sequenceVerified != null ? Boolean(body.sequenceVerified) : undefined,
        notes:            body.notes?.trim()       || null,
        lowThresholdType:  body.lowThresholdType  || null,
        lowThresholdAmber: body.lowThresholdAmber != null ? Number(body.lowThresholdAmber) : null,
        lowThresholdRed:   body.lowThresholdRed   != null ? Number(body.lowThresholdRed)   : null,
      },
      include: { attachments: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH plasmid prep failed:", error);
    return NextResponse.json({ error: "Failed to update prep" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Context) {
  const { id, prepId } = await getParams(ctx);
  const user = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const plasmid = await prisma.plasmid.findUnique({ where: { id }, select: { owner: true } });
    if (!plasmid) return NextResponse.json({ error: "Plasmid not found" }, { status: 404 });
    if (plasmid.owner && plasmid.owner !== user && user !== "Admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.plasmidPrep.delete({ where: { id: prepId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE plasmid prep failed:", error);
    return NextResponse.json({ error: "Failed to delete prep" }, { status: 500 });
  }
}
