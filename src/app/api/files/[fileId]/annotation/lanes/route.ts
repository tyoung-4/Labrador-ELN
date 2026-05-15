import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    annotationId?: string;
    laneNumber?: number;
    ladderId?: string;
    ladderName?: string;
    contents?: string;
    inventoryId?: string;
    inventoryType?: string;
    inventoryName?: string;
  };

  if (!body.annotationId || body.laneNumber === undefined) {
    return NextResponse.json({ error: "annotationId and laneNumber required" }, { status: 400 });
  }

  const lane = await prisma.gelLane.create({
    data: {
      annotationId: body.annotationId,
      laneNumber: body.laneNumber,
      ladderId: body.ladderId ?? null,
      ladderName: body.ladderName ?? "",
      contents: body.contents ?? "",
      inventoryId: body.inventoryId ?? "",
      inventoryType: body.inventoryType ?? "",
      inventoryName: body.inventoryName ?? "",
    },
  });
  return NextResponse.json(lane, { status: 201 });
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    laneId?: string;
    ladderId?: string | null;
    ladderName?: string;
    contents?: string;
    inventoryId?: string;
    inventoryType?: string;
    inventoryName?: string;
  };

  if (!body.laneId) return NextResponse.json({ error: "laneId required" }, { status: 400 });

  const lane = await prisma.gelLane.update({
    where: { id: body.laneId },
    data: {
      ...(body.ladderId !== undefined && { ladderId: body.ladderId }),
      ...(body.ladderName !== undefined && { ladderName: body.ladderName }),
      ...(body.contents !== undefined && { contents: body.contents }),
      ...(body.inventoryId !== undefined && { inventoryId: body.inventoryId }),
      ...(body.inventoryType !== undefined && { inventoryType: body.inventoryType }),
      ...(body.inventoryName !== undefined && { inventoryName: body.inventoryName }),
    },
  });
  return NextResponse.json(lane);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({})) as { laneId?: string };
  if (!body.laneId) return NextResponse.json({ error: "laneId required" }, { status: 400 });
  await prisma.gelLane.delete({ where: { id: body.laneId } });
  return new NextResponse(null, { status: 204 });
}
