import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest, isAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };
async function getId(c: RouteContext) { return (await c.params).id; }

// POST /api/protocol-runs/[id]/unlock  Body: { reason }
// Admin-only. Re-opens a locked run for editing. The unlock is itself audited.
export async function POST(request: NextRequest, context: RouteContext) {
  const id = await getId(context);
  try {
    const actor = await getActorFromRequest(request);
    if (!isAdmin(actor)) {
      return NextResponse.json({ error: "Only an admin can unlock a run" }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const reason = (body.reason ?? "").trim();
    if (!reason) {
      return NextResponse.json({ error: "A reason is required to unlock" }, { status: 400 });
    }

    const run = await prisma.protocolRun.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!run) return new NextResponse(null, { status: 404 });
    if (run.status !== "COMPLETED" && run.status !== "ABORTED") {
      return NextResponse.json({ error: "Run is not signed/locked" }, { status: 409 });
    }

    await prisma.protocolRun.update({ where: { id }, data: { status: "IN_PROGRESS", completedAt: null } });
    await recordAudit({ entityType: "RUN", entityId: id, action: "UNLOCK", actor, summary: `Unlocked: ${reason}` });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`POST /api/protocol-runs/${id}/unlock failed:`, error);
    return NextResponse.json({ error: "Failed to unlock run" }, { status: 500 });
  }
}
