import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest, ensureActor, type Actor } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

function canAccessRun(actor: Actor, runnerId: string | null): boolean {
  if (actor.role === "ADMIN") return true;
  return Boolean(runnerId && actor.id === runnerId);
}

async function getRunId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return resolved.id;
}

async function enrichRunWithTags<T extends { id: string }>(run: T) {
  const tagAssignments = await prisma.tagAssignment.findMany({
    where: { entityType: "RUN", entityId: run.id },
    include: { tag: { select: { id: true, name: true, type: true, color: true } } },
  });
  return { ...run, tagAssignments };
}

export async function GET(request: Request, context: RouteContext) {
  const id = await getRunId(context);
  try {
    const actor = await getActorFromRequest(request);
    await ensureActor(actor);

    const found = await prisma.protocolRun.findUnique({
      where: { id },
      include: {
        sourceEntry: {
          select: {
            id: true,
            title: true,
            description: true,
            technique: true,
            version: true,
            author: { select: { id: true, name: true, role: true } },
          },
        },
        runner: { select: { id: true, name: true, role: true } },
        protocol: {
          select: {
            id: true,
            name: true,
            technique: true,
            shortDescription: true,
            sections: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                name: true,
                order: true,
                steps: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    id: true,
                    stepType: true,
                    parentStepId: true,
                    estimatedMinutes: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!found) return new NextResponse(null, { status: 404 });
    if (!canAccessRun(actor, found.runnerId)) {
      return NextResponse.json({ error: "Not allowed to view this run" }, { status: 403 });
    }

    return NextResponse.json(await enrichRunWithTags(found));
  } catch (error) {
    console.error(`GET /api/protocol-runs/${id} failed:`, error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to load protocol run", detail }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const id = await getRunId(context);
  try {
    const actor = await getActorFromRequest(request);
    await ensureActor(actor);

    const existing = await prisma.protocolRun.findUnique({ where: { id }, select: { runnerId: true, status: true } });
    if (!existing) return new NextResponse(null, { status: 404 });
    if (!canAccessRun(actor, existing.runnerId)) {
      return NextResponse.json({ error: "Not allowed to update this run" }, { status: 403 });
    }
    if (existing.status === "COMPLETED" || existing.status === "ABORTED") {
      return NextResponse.json({ error: "Run already ended and is locked." }, { status: 409 });
    }

    const payload = await request.json().catch(() => ({}));
    const nextStatus = typeof payload.status === "string" ? payload.status : undefined;
    const isEnding = nextStatus === "COMPLETED" || nextStatus === "ABORTED";
    const updated = await prisma.protocolRun.update({
      where: { id },
      data: {
        interactionState: typeof payload.interactionState === "string" ? payload.interactionState : undefined,
        status: nextStatus,
        locked: isEnding ? true : undefined,
        completedAt: isEnding ? new Date() : undefined,
        notes: typeof payload.notes === "string" ? payload.notes : undefined,
        abortNotes: typeof payload.abortNotes === "string" ? payload.abortNotes : undefined,
      },
      include: {
        sourceEntry: {
          select: {
            id: true,
            title: true,
            description: true,
            technique: true,
            version: true,
            author: { select: { id: true, name: true, role: true } },
          },
        },
        runner: { select: { id: true, name: true, role: true } },
        protocol: {
          select: {
            id: true,
            name: true,
            technique: true,
            shortDescription: true,
            sections: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                name: true,
                order: true,
                steps: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    id: true,
                    stepType: true,
                    parentStepId: true,
                    estimatedMinutes: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(await enrichRunWithTags(updated));
  } catch (error) {
    console.error(`PUT /api/protocol-runs/${id} failed:`, error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to update protocol run", detail }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const id = await getRunId(context);
  try {
    const actor = await getActorFromRequest(request);
    await ensureActor(actor);

    const existing = await prisma.protocolRun.findUnique({
      where: { id },
      select: { runnerId: true, isMockRun: true },
    });
    if (!existing) return new NextResponse(null, { status: 404 });
    if (!existing.isMockRun) {
      return NextResponse.json({ error: "Only mock runs can be deleted." }, { status: 400 });
    }
    if (!canAccessRun(actor, existing.runnerId)) {
      return NextResponse.json({ error: "Not allowed to delete this run." }, { status: 403 });
    }

    await prisma.protocolRun.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const isMissing = typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2025";
    if (isMissing) return new NextResponse(null, { status: 404 });
    console.error(`DELETE /api/protocol-runs/${id} failed:`, error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to delete run", detail }, { status: 500 });
  }
}
