import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Actor = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

function getActorFromRequest(request?: Request): Actor {
  const headerId = request?.headers.get("x-user-id")?.trim();
  const headerName = request?.headers.get("x-user-name")?.trim();
  const headerRole = request?.headers.get("x-user-role")?.trim().toUpperCase();
  const name = headerName || "Finn";
  const safeId = headerId || `user-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "member"}`;
  const role: "ADMIN" | "MEMBER" = headerRole === "ADMIN" ? "ADMIN" : "MEMBER";
  return { id: safeId, name, email: `${safeId}@local.eln`, role };
}

async function ensureActor(actor: Actor) {
  return prisma.user.upsert({
    where: { id: actor.id },
    create: { id: actor.id, name: actor.name, email: actor.email, role: actor.role },
    update: { name: actor.name, role: actor.role },
  });
}

async function getRunId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return resolved.id;
}

/** GET /api/protocol-runs/[id]/step-results — list all step results for a run */
export async function GET(request: Request, context: RouteContext) {
  const runId = await getRunId(context);
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    const run = await prisma.protocolRun.findUnique({ where: { id: runId }, select: { runnerId: true } });
    if (!run) return new NextResponse(null, { status: 404 });
    if (actor.role !== "ADMIN" && run.runnerId !== actor.id) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const results = await prisma.stepResult.findMany({
      where: { runId },
      orderBy: { completedAt: "asc" },
    });
    return NextResponse.json(results);
  } catch (error) {
    console.error("GET step-results failed:", error);
    return NextResponse.json({ error: "Failed to load step results" }, { status: 500 });
  }
}

/** POST /api/protocol-runs/[id]/step-results — record a step result (upsert) */
export async function POST(request: Request, context: RouteContext) {
  const runId = await getRunId(context);
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    const run = await prisma.protocolRun.findUnique({
      where: { id: runId },
      select: { runnerId: true, status: true },
    });
    if (!run) return new NextResponse(null, { status: 404 });
    if (run.status === "COMPLETED") {
      return NextResponse.json({ error: "Run is already completed and locked." }, { status: 409 });
    }
    if (actor.role !== "ADMIN" && run.runnerId !== actor.id) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const stepId = String(payload.stepId ?? "").trim();
    const result = String(payload.result ?? "").trim().toUpperCase();
    const notes = typeof payload.notes === "string" ? payload.notes : "";
    const fieldValues = typeof payload.fieldValues === "object" && payload.fieldValues !== null
      ? JSON.stringify(payload.fieldValues)
      : typeof payload.fieldValues === "string"
      ? payload.fieldValues
      : "{}";

    if (!stepId) return NextResponse.json({ error: "stepId is required" }, { status: 400 });
    if (!["PASSED", "FAILED", "SKIPPED"].includes(result)) {
      return NextResponse.json({ error: "result must be PASSED, FAILED, or SKIPPED" }, { status: 400 });
    }

    const stepResult = await prisma.stepResult.upsert({
      where: { runId_stepId: { runId, stepId } },
      create: { runId, stepId, result, notes, fieldValues, completedAt: new Date() },
      update: { result, notes, fieldValues, completedAt: new Date() },
    });

    return NextResponse.json(stepResult, { status: 201 });
  } catch (error) {
    console.error("POST step-results failed:", error);
    return NextResponse.json({ error: "Failed to record step result" }, { status: 500 });
  }
}

/** DELETE /api/protocol-runs/[id]/step-results — undo a step result (idempotent) */
export async function DELETE(request: Request, context: RouteContext) {
  const runId = await getRunId(context);
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    const run = await prisma.protocolRun.findUnique({
      where: { id: runId },
      select: { runnerId: true, status: true },
    });
    if (!run) return new NextResponse(null, { status: 404 });
    if (run.status === "COMPLETED") {
      return NextResponse.json({ error: "Run is already completed and locked." }, { status: 409 });
    }
    if (actor.role !== "ADMIN" && run.runnerId !== actor.id) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const stepId = String(payload.stepId ?? "").trim();
    if (!stepId) return NextResponse.json({ error: "stepId is required" }, { status: 400 });

    // Idempotent — no error if row doesn't exist
    await prisma.stepResult.deleteMany({ where: { runId, stepId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE step-results failed:", error);
    return NextResponse.json({ error: "Failed to delete step result" }, { status: 500 });
  }
}
