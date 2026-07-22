import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest, canEditEntity } from "@/lib/auth";

const BINDER_TYPES = ["MEDITOPE", "FCR_BINDER", "CUSTOM"];

async function loadOwner(antibodyId: string, binderId: string) {
  const binder = await prisma.antibodyBinder.findFirst({
    where: { id: binderId, antibodyId },
    select: { id: true, antibody: { select: { owner: true } } },
  });
  return binder ? { exists: true, owner: binder.antibody.owner } : { exists: false, owner: "" };
}

// PATCH /api/antibodies/[id]/binders/[binderId] — owner or Admin.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; binderId: string }> },
) {
  const { id, binderId } = await params;
  const actor = await getActorFromRequest(req);

  const { exists, owner } = await loadOwner(id, binderId);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditEntity(actor, owner)) {
    return NextResponse.json({ error: "Not allowed to edit this antibody" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.type === "string") {
    if (!BINDER_TYPES.includes(body.type)) {
      return NextResponse.json({ error: `type must be one of ${BINDER_TYPES.join(", ")}` }, { status: 400 });
    }
    data.type = body.type;
  }
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("attachPoint" in body) data.attachPoint = body.attachPoint?.trim() || null;
  if ("description" in body) data.description = body.description?.trim() || null;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const binder = await prisma.antibodyBinder.update({ where: { id: binderId }, data });
  return NextResponse.json({ success: true, binder });
}

// DELETE /api/antibodies/[id]/binders/[binderId] — owner or Admin.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; binderId: string }> },
) {
  const { id, binderId } = await params;
  const actor = await getActorFromRequest(req);

  const { exists, owner } = await loadOwner(id, binderId);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditEntity(actor, owner)) {
    return NextResponse.json({ error: "Not allowed to edit this antibody" }, { status: 403 });
  }

  await prisma.antibodyBinder.delete({ where: { id: binderId } });
  return NextResponse.json({ success: true });
}
