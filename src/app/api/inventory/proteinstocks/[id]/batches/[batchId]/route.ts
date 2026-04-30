import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string; batchId: string }> | { id: string; batchId: string } };

export async function PATCH(
  req: NextRequest,
  ctx: Context
) {
  const params = await ctx.params;
  try {
    const body = await req.json();
    const editedBy = req.headers.get("x-user-name") ?? "Unknown";

    // Only allow editing mutable fields — batchId, purificationDate,
    // initialVolume, currentVolume are immutable after creation
    const updated = await prisma.proteinBatch.update({
      where: { id: params.batchId },
      data: {
        concentration: body.concentration != null ? Number(body.concentration) : null,
        mw: body.mw != null ? Number(body.mw) : null,
        extinctionCoeff: body.extinctionCoeff != null ? Number(body.extinctionCoeff) : null,
        a280: body.a280 != null ? Number(body.a280) : null,
        storageBuffer: body.storageBuffer?.trim() || null,
        storageLocationText: body.storageLocationText?.trim() || null,
        lowThresholdType: body.lowThresholdType || null,
        lowThresholdAmber: body.lowThresholdAmber != null ? Number(body.lowThresholdAmber) : null,
        lowThresholdRed: body.lowThresholdRed != null ? Number(body.lowThresholdRed) : null,
        notes: body.notes?.trim() || null,
      },
    });

    // Log edit if audit is requested
    if (body.warningShown) {
      await prisma.inventoryEditLog.create({
        data: {
          entityType: "PROTEIN_BATCH",
          entityId: params.batchId,
          editedBy,
          fieldName: "batch_edit",
          warningShown: true,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH batch failed:", error);
    return NextResponse.json({ error: "Failed to update batch" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: Context
) {
  const params = await ctx.params;
  try {
    await prisma.proteinBatch.delete({ where: { id: params.batchId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE batch failed:", error);
    return NextResponse.json({ error: "Failed to delete batch" }, { status: 500 });
  }
}
