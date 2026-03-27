import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Actor = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};

function getActorFromRequest(request?: Request): Actor {
  const headerId = request?.headers.get("x-user-id")?.trim();
  const headerName = request?.headers.get("x-user-name")?.trim();
  const headerRole = request?.headers.get("x-user-role")?.trim().toUpperCase();

  const name = headerName || "Finn";
  const safeId = headerId || `user-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "member"}`;
  const role: "ADMIN" | "MEMBER" = headerRole === "ADMIN" ? "ADMIN" : "MEMBER";

  return {
    id: safeId,
    name,
    email: `${safeId}@local.eln`,
    role,
  };
}

async function ensureActor(actor: Actor) {
  return prisma.user.upsert({
    where: { id: actor.id },
    create: {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
    },
    update: {
      name: actor.name,
      role: actor.role,
    },
  });
}

export async function GET(request: Request) {
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status"); // "active" | "completed" | null (all)

    // Map friendly query param to DB status values
    let statusFilter: string | undefined;
    if (statusParam === "active")    statusFilter = "IN_PROGRESS";
    if (statusParam === "completed") statusFilter = "COMPLETED";

    const runs = await prisma.protocolRun.findMany({
      where: {
        ...(actor.role === "ADMIN" ? {} : { runnerId: actor.id }),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        sourceEntry: {
          select: {
            id: true,
            title: true,
            description: true,
            technique: true,
            author: { select: { id: true, name: true, role: true } },
          },
        },
        runner: { select: { id: true, name: true, role: true } },
      },
    });

    // Enrich with polymorphic tagAssignments
    const runIds = runs.map((r) => r.id);
    const tagAssignments = runIds.length
      ? await prisma.tagAssignment.findMany({
          where: { entityType: "RUN", entityId: { in: runIds } },
          include: { tag: { select: { id: true, name: true, type: true, color: true } } },
        })
      : [];
    const tagMap = new Map<string, typeof tagAssignments>();
    for (const a of tagAssignments) {
      const list = tagMap.get(a.entityId) ?? [];
      list.push(a);
      tagMap.set(a.entityId, list);
    }
    const enriched = runs.map((r) => ({ ...r, tagAssignments: tagMap.get(r.id) ?? [] }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/protocol-runs failed:", error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to load protocol runs", detail }, { status: 500 });
  }
}

/** Generates a unique 10-character alphanumeric Run ID (A–Z, 0–9). */
async function generateRunId(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let attempt = 0; attempt < 20; attempt++) {
    let id = "";
    for (let i = 0; i < 10; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    const existing = await prisma.protocolRun.findUnique({ where: { runId: id } });
    if (!existing) return id;
  }
  throw new Error("Failed to generate unique Run ID after 20 attempts");
}

export async function POST(request: Request) {
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    const payload = await request.json().catch(() => ({}));
    const sourceEntryId = String(payload.sourceEntryId ?? "").trim();
    // Operator is always the logged-in user (actor derived from x-user-name header)
    const operatorName = actor.name;
    if (!sourceEntryId) {
      return NextResponse.json({ error: "sourceEntryId is required" }, { status: 400 });
    }

    const [source, sourceProtocol] = await Promise.all([
      prisma.entry.findUnique({ where: { id: sourceEntryId } }),
      prisma.protocol.findUnique({ where: { entryId: sourceEntryId } }),
    ]);
    if (!source) return new NextResponse(null, { status: 404 });

    // Store the full body as runBody so the new run page can parse it
    // (new ProtocolStepsEditor stores JSON; legacy stores HTML)
    const runBodyContent = source.body;

    const [runCount, runId] = await Promise.all([
      prisma.protocolRun.count({ where: { sourceEntryId } }),
      generateRunId(),
    ]);
    const created = await prisma.protocolRun.create({
      data: {
        runId,
        sourceEntryId,
        protocolId: sourceProtocol?.id ?? null,
        title: `${source.title} - Run ${runCount + 1}`,
        status: "IN_PROGRESS",
        locked: true,
        runBody: runBodyContent,
        notes: "",
        interactionState: JSON.stringify({
          stepCompletion: {},
          components: {},
          componentAmounts: {},
          entryFields: {},
          timers: {},
          currentStepIdx: 0,
        }),
        operatorName,
        runnerId: actor.id,
      },
      include: {
        sourceEntry: {
          select: {
            id: true,
            title: true,
            description: true,
            technique: true,
            author: { select: { id: true, name: true, role: true } },
          },
        },
        runner: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/protocol-runs failed:", error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to create protocol run", detail }, { status: 500 });
  }
}
