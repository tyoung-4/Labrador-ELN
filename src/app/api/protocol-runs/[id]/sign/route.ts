import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest } from "@/lib/auth";
import { recordAudit, snapshotHash } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };
async function getId(c: RouteContext) { return (await c.params).id; }

// POST /api/protocol-runs/[id]/sign
// Body: { meaning?: "COMPLETION"|"REVIEW"|"WITNESS", statement?: string }
// Signs and locks the run: writes a Signature + audit (SIGN, LOCK) and sets the
// run COMPLETED + locked. Refuses if already locked.
export async function POST(request: NextRequest, context: RouteContext) {
  const id = await getId(context);
  try {
    const actor = await getActorFromRequest(request);
    if (actor.id === "__anonymous__") {
      return NextResponse.json({ error: "Authentication required to sign" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { meaning?: string; statement?: string };
    const meaning = (body.meaning ?? "COMPLETION").toUpperCase();
    const statement = (body.statement ?? "I confirm these results are accurate and complete.").trim();

    const run = await prisma.protocolRun.findUnique({ where: { id } });
    if (!run) return new NextResponse(null, { status: 404 });
    // Immutability is keyed off status — `locked` is the run engine's own flag
    // (true during an active run), not the signed signal.
    if (run.status === "COMPLETED" || run.status === "ABORTED") {
      return NextResponse.json({ error: "Run is already signed and locked." }, { status: 409 });
    }

    // Snapshot the record at signing time for tamper-evidence.
    const contentHash = snapshotHash({
      id: run.id, runId: run.runId, status: "COMPLETED",
      runBody: run.runBody, interactionState: run.interactionState,
      notes: run.notes, signedBy: actor.id,
    });

    const [signature, updated] = await prisma.$transaction([
      prisma.signature.create({
        data: {
          entityType: "RUN", entityId: id,
          signerId: actor.id, signerName: actor.name,
          meaning, statement, contentHash,
        },
      }),
      prisma.protocolRun.update({
        where: { id },
        data: { status: "COMPLETED", locked: true, completedAt: new Date() },
      }),
    ]);

    await recordAudit({ entityType: "RUN", entityId: id, action: "SIGN", actor, summary: `${meaning} signed by ${actor.name}` });
    await recordAudit({ entityType: "RUN", entityId: id, action: "LOCK", actor, summary: "Run locked on signature" });

    return NextResponse.json({ success: true, signature, run: { id: updated.id, status: updated.status, locked: updated.locked } });
  } catch (error) {
    console.error(`POST /api/protocol-runs/${id}/sign failed:`, error);
    return NextResponse.json({ error: "Failed to sign run" }, { status: 500 });
  }
}
