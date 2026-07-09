import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest } from "@/lib/auth";

// GET /api/expression/[id] — full run with plasmids + actions.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.expressionTimeline.findUnique({
    where: { id },
    include: {
      plasmids: { orderBy: { order: "asc" } },
      actions: { orderBy: [{ scheduledDate: "asc" }, { id: "asc" }] },
    },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(run);
}

// PATCH /api/expression/[id] — update status / notes / harvest.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.notes === "string") data.notes = body.notes;
  if (typeof body.status === "string" && ["IN_PROGRESS", "HARVESTED", "CANCELLED"].includes(body.status)) {
    data.status = body.status;
    if (body.status === "HARVESTED") data.harvestedAt = new Date();
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const run = await prisma.expressionTimeline.update({
    where: { id },
    data,
    include: {
      plasmids: { orderBy: { order: "asc" } },
      actions: { orderBy: [{ scheduledDate: "asc" }, { id: "asc" }] },
    },
  });
  return NextResponse.json(run);
}

// DELETE /api/expression/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await getActorFromRequest(req);
  const { id } = await params;
  await prisma.expressionTimeline.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
