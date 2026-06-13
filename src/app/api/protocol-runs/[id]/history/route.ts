import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAuditChain } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };
async function getId(c: RouteContext) { return (await c.params).id; }

// GET /api/protocol-runs/[id]/history
// Returns the audit timeline + signatures for a run, plus chain integrity.
export async function GET(_request: NextRequest, context: RouteContext) {
  const id = await getId(context);
  try {
    const [audit, signatures, integrity] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entityType: "RUN", entityId: id },
        orderBy: { createdAt: "asc" },
        select: { id: true, action: true, actorName: true, summary: true, createdAt: true, hash: true },
      }),
      prisma.signature.findMany({
        where: { entityType: "RUN", entityId: id },
        orderBy: { signedAt: "asc" },
      }),
      verifyAuditChain("RUN", id),
    ]);
    return NextResponse.json({ audit, signatures, integrity });
  } catch (error) {
    console.error(`GET /api/protocol-runs/${id}/history failed:`, error);
    return NextResponse.json({ error: "Failed to load run history" }, { status: 500 });
  }
}
