import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest } from "@/lib/auth";

// PATCH /api/expression/[id]/actions/[actionId] — toggle an action done/undone.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> },
) {
  const actor = await getActorFromRequest(req);
  const { id, actionId } = await params;
  const body = await req.json().catch(() => ({}));
  const done = Boolean(body.done);

  const action = await prisma.expressionAction.findFirst({
    where: { id: actionId, timelineId: id },
  });
  if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.expressionAction.update({
    where: { id: actionId },
    data: {
      done,
      doneAt: done ? new Date() : null,
      doneBy: done ? actor?.name ?? null : null,
    },
  });
  return NextResponse.json(updated);
}
