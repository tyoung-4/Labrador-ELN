import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    annotationId?: string;
    peakNumber?: number;
    label?: string;
    retentionVolume?: number;
    inventoryId?: string;
    inventoryType?: string;
    inventoryName?: string;
  };

  if (!body.annotationId || body.peakNumber === undefined) {
    return NextResponse.json({ error: "annotationId and peakNumber required" }, { status: 400 });
  }

  const peak = await prisma.chromatogramPeak.create({
    data: {
      annotationId: body.annotationId,
      peakNumber: body.peakNumber,
      label: body.label ?? "",
      retentionVolume: body.retentionVolume ?? null,
      inventoryId: body.inventoryId ?? "",
      inventoryType: body.inventoryType ?? "",
      inventoryName: body.inventoryName ?? "",
    },
  });
  return NextResponse.json(peak, { status: 201 });
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    peakId?: string;
    label?: string;
    retentionVolume?: number | null;
    inventoryId?: string;
    inventoryType?: string;
    inventoryName?: string;
  };

  if (!body.peakId) return NextResponse.json({ error: "peakId required" }, { status: 400 });

  const peak = await prisma.chromatogramPeak.update({
    where: { id: body.peakId },
    data: {
      ...(body.label !== undefined && { label: body.label }),
      ...(body.retentionVolume !== undefined && { retentionVolume: body.retentionVolume }),
      ...(body.inventoryId !== undefined && { inventoryId: body.inventoryId }),
      ...(body.inventoryType !== undefined && { inventoryType: body.inventoryType }),
      ...(body.inventoryName !== undefined && { inventoryName: body.inventoryName }),
    },
  });
  return NextResponse.json(peak);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({})) as { peakId?: string };
  if (!body.peakId) return NextResponse.json({ error: "peakId required" }, { status: 400 });
  await prisma.chromatogramPeak.delete({ where: { id: body.peakId } });
  return new NextResponse(null, { status: 204 });
}
