import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/inventory/usage?itemType=plasmid&itemId=<id>
// Reverse lookup: which runs used this inventory item. Powers the "Used in N
// runs" links on inventory item rows. See docs/CROSS_LINKING_DESIGN.md.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemType = (searchParams.get("itemType") ?? "").toLowerCase();
  const itemId = searchParams.get("itemId") ?? "";
  if (!itemType || !itemId) {
    return NextResponse.json({ error: "itemType and itemId are required" }, { status: 400 });
  }

  const usage = await prisma.runInventoryUsage.findMany({
    where: { itemType, itemId },
    orderBy: { createdAt: "desc" },
    include: {
      run: { select: { id: true, runId: true, title: true, status: true, completedAt: true } },
    },
  });

  // One item can be logged once per run; collapse to distinct runs (defensive).
  const byRun = new Map<string, {
    runId: string; runCode: string | null; title: string; status: string;
    completedAt: Date | null; amountUsed: number | null; unit: string | null;
  }>();
  for (const u of usage) {
    if (!u.run) continue;
    if (!byRun.has(u.run.id)) {
      byRun.set(u.run.id, {
        runId: u.run.id,
        runCode: u.run.runId,
        title: u.run.title,
        status: u.run.status,
        completedAt: u.run.completedAt,
        amountUsed: u.amountUsed,
        unit: u.unit,
      });
    }
  }

  return NextResponse.json({ count: byRun.size, runs: Array.from(byRun.values()) });
}
