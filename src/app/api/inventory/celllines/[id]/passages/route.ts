import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> | { id: string } };
async function getId(ctx: Context) { const p = await ctx.params; return p.id; }

export async function GET(_req: NextRequest, ctx: Context) {
  const id = await getId(ctx);
  try {
    const passages = await prisma.cellLinePassage.findMany({
      where: { cellLineId: id },
      include: { attachments: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(passages);
  } catch (error) {
    console.error("GET cell line passages failed:", error);
    return NextResponse.json({ error: "Failed to load passages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Context) {
  const id   = await getId(ctx);
  const user = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const body     = await req.json();
    const cellLine = await prisma.cellLine.findUnique({ where: { id } });
    if (!cellLine) return NextResponse.json({ error: "Cell line not found" }, { status: 404 });

    const passage = await prisma.cellLinePassage.create({
      data: {
        cellLineId:       id,
        passage:          body.passage    != null ? Number(body.passage)   : null,
        vialCount:        body.vialCount  != null ? Number(body.vialCount) : null,
        freezeBackDate:   body.freezeBackDate   ? new Date(body.freezeBackDate)   : null,
        freezingSolution: body.freezingSolution?.trim() || null,
        frozenBy:         body.frozenBy?.trim()         || user,
        storageLocation:  body.storageLocation?.trim()  || null,
        notes:            body.notes?.trim()            || null,
        lowThresholdType:  body.lowThresholdType  || null,
        lowThresholdAmber: body.lowThresholdAmber != null ? Number(body.lowThresholdAmber) : null,
        lowThresholdRed:   body.lowThresholdRed   != null ? Number(body.lowThresholdRed)   : null,
        createdBy:        user,
      },
      include: { attachments: true },
    });
    return NextResponse.json(passage, { status: 201 });
  } catch (error) {
    console.error("POST cell line passage failed:", error);
    return NextResponse.json({ error: "Failed to create passage" }, { status: 500 });
  }
}
