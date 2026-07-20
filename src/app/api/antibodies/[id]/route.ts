import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest, canEditEntity } from "@/lib/auth";

// GET /api/antibodies/[id] — full antibody with annotations + binders, plus the
// linked ProteinStock name (proteinStockId is a soft link, not a hard FK).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const antibody = await prisma.antibody.findUnique({
    where: { id },
    include: {
      annotations: { orderBy: [{ chain: "asc" }, { region: "asc" }, { position: "asc" }] },
      binders: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!antibody) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let proteinStockName: string | null = null;
  if (antibody.proteinStockId) {
    const stock = await prisma.proteinStock.findUnique({
      where: { id: antibody.proteinStockId },
      select: { name: true },
    });
    proteinStockName = stock?.name ?? null;
  }

  return NextResponse.json({ ...antibody, proteinStockName });
}

// PATCH /api/antibodies/[id] — update metadata. Owner or Admin only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActorFromRequest(req);

  const antibody = await prisma.antibody.findUnique({ where: { id }, select: { owner: true } });
  if (!antibody) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditEntity(actor, antibody.owner)) {
    return NextResponse.json({ error: "Not allowed to edit this antibody" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("parentName" in body) data.parentName = body.parentName?.trim() || null;
  if (typeof body.format === "string" && body.format.trim()) data.format = body.format.trim();
  if (typeof body.isSymmetric === "boolean") data.isSymmetric = body.isSymmetric;
  if ("description" in body) data.description = body.description?.trim() || null;
  if ("proteinStockId" in body) data.proteinStockId = body.proteinStockId || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  data.lastEditedBy = actor.name;
  data.lastEditedAt = new Date();

  const updated = await prisma.antibody.update({ where: { id }, data });
  return NextResponse.json({ success: true, antibody: updated });
}

// DELETE /api/antibodies/[id] — owner or Admin. Annotations + binders cascade.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActorFromRequest(req);

  const antibody = await prisma.antibody.findUnique({ where: { id }, select: { owner: true } });
  if (!antibody) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditEntity(actor, antibody.owner)) {
    return NextResponse.json({ error: "Not allowed to delete this antibody" }, { status: 403 });
  }

  await prisma.antibody.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
