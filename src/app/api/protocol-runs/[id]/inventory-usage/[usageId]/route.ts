import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// DELETE /api/protocol-runs/[id]/inventory-usage/[usageId]
// Remove a usage row. Allowed only while the run is IN_PROGRESS.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; usageId: string }> },
) {
  const { id, usageId } = await params;

  const run = await prisma.protocolRun.findUnique({ where: { id }, select: { status: true } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Run is completed — inventory usage is locked." }, { status: 409 });
  }

  // Scoped to runId so a usage id can't be deleted through the wrong run.
  await prisma.runInventoryUsage.deleteMany({ where: { id: usageId, runId: id } });
  return NextResponse.json({ ok: true });
}
