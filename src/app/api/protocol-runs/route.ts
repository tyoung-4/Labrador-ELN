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

    const runs = await prisma.protocolRun.findMany({
      where: actor.role === "ADMIN" ? undefined : { runnerId: actor.id },
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

    return NextResponse.json(runs);
  } catch (error) {
    console.error("GET /api/protocol-runs failed:", error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to load protocol runs", detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    const payload = await request.json().catch(() => ({}));
    const sourceEntryId = String(payload.sourceEntryId ?? "").trim();
    if (!sourceEntryId) {
      return NextResponse.json({ error: "sourceEntryId is required" }, { status: 400 });
    }

    const source = await prisma.entry.findUnique({ where: { id: sourceEntryId } });
    if (!source) return new NextResponse(null, { status: 404 });

    // Extract just the "steps" HTML from body if stored as JSON-encoded protocol body
    let runBodyContent = source.body;
    try {
      const parsed = JSON.parse(source.body) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && "steps" in parsed && typeof parsed.steps === "string") {
        runBodyContent = parsed.steps;
      }
    } catch {
      // Legacy plain HTML body — use as-is
    }

    const runCount = await prisma.protocolRun.count({ where: { sourceEntryId } });
    const created = await prisma.protocolRun.create({
      data: {
        sourceEntryId,
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
        }),
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
