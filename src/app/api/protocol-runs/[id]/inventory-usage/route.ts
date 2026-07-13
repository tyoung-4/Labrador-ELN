import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest } from "@/lib/auth";

// Actual inventory used in a run (run-time capture). Editable only while the run
// is IN_PROGRESS; it locks with the run on completion. See
// docs/CROSS_LINKING_DESIGN.md.

const VALID_TYPES = new Set(["reagent", "stock", "plasmid", "cellline"]);

// GET /api/protocol-runs/[id]/inventory-usage — list usage for a run.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usage = await prisma.runInventoryUsage.findMany({
    where: { runId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(usage);
}

// POST /api/protocol-runs/[id]/inventory-usage — add an item that was used.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActorFromRequest(req);

  const run = await prisma.protocolRun.findUnique({ where: { id }, select: { status: true } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Run is completed — inventory usage is locked." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const itemType = String(body?.itemType ?? "").toLowerCase();
  if (!body?.itemId || !VALID_TYPES.has(itemType)) {
    return NextResponse.json({ error: "itemId and a valid itemType are required" }, { status: 400 });
  }

  const usage = await prisma.runInventoryUsage.create({
    data: {
      runId: id,
      itemType,
      itemId: String(body.itemId),
      itemName: String(body.itemName ?? "").trim() || "(unnamed item)",
      itemDetail: typeof body.itemDetail === "string" ? body.itemDetail : "",
      amountUsed: body.amountUsed != null && body.amountUsed !== "" ? Number(body.amountUsed) : null,
      unit: body.unit ? String(body.unit) : null,
      notes: typeof body.notes === "string" ? body.notes : "",
      lotId: body.lotId ? String(body.lotId) : null,
      stepId: body.stepId ? String(body.stepId) : null,
      addedBy: actor?.name ?? "",
    },
  });
  return NextResponse.json(usage, { status: 201 });
}
