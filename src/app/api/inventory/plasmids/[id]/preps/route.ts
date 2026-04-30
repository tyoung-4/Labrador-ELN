import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> | { id: string } };
async function getId(ctx: Context) { const p = await ctx.params; return p.id; }

export async function GET(_req: NextRequest, ctx: Context) {
  const id = await getId(ctx);
  try {
    const preps = await prisma.plasmidPrep.findMany({
      where: { plasmidId: id },
      include: { attachments: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(preps);
  } catch (error) {
    console.error("GET plasmid preps failed:", error);
    return NextResponse.json({ error: "Failed to load preps" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Context) {
  const id   = await getId(ctx);
  const user = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const body    = await req.json();
    const plasmid = await prisma.plasmid.findUnique({ where: { id } });
    if (!plasmid) return NextResponse.json({ error: "Plasmid not found" }, { status: 404 });

    const prep = await prisma.plasmidPrep.create({
      data: {
        plasmidId:        id,
        prepDate:         body.prepDate ? new Date(body.prepDate) : null,
        prepType:         body.prepType?.trim()    || null,
        concentration:    body.concentration != null ? Number(body.concentration) : null,
        volume:           body.volume        != null ? Number(body.volume)        : null,
        preparedBy:       body.preparedBy?.trim()  || user,
        sequenceVerified: Boolean(body.sequenceVerified),
        notes:            body.notes?.trim()       || null,
        lowThresholdType:  body.lowThresholdType  || null,
        lowThresholdAmber: body.lowThresholdAmber != null ? Number(body.lowThresholdAmber) : null,
        lowThresholdRed:   body.lowThresholdRed   != null ? Number(body.lowThresholdRed)   : null,
        createdBy:        user,
      },
      include: { attachments: true },
    });
    return NextResponse.json(prep, { status: 201 });
  } catch (error) {
    console.error("POST plasmid prep failed:", error);
    return NextResponse.json({ error: "Failed to create prep" }, { status: 500 });
  }
}
