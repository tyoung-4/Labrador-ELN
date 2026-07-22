import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest, canEditEntity } from "@/lib/auth";

const BINDER_TYPES = ["MEDITOPE", "FCR_BINDER", "CUSTOM"];

// GET /api/antibodies/[id]/binders
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const binders = await prisma.antibodyBinder.findMany({
    where: { antibodyId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(binders);
}

// POST /api/antibodies/[id]/binders — owner or Admin.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActorFromRequest(req);

  const antibody = await prisma.antibody.findUnique({ where: { id }, select: { owner: true } });
  if (!antibody) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditEntity(actor, antibody.owner)) {
    return NextResponse.json({ error: "Not allowed to edit this antibody" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const type = String(body.type ?? "");
  if (!BINDER_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of ${BINDER_TYPES.join(", ")}` }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const binder = await prisma.antibodyBinder.create({
    data: {
      antibodyId: id,
      type,
      name,
      attachPoint: typeof body.attachPoint === "string" && body.attachPoint.trim() ? body.attachPoint.trim() : null,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      createdBy: actor.name,
    },
  });
  return NextResponse.json({ success: true, binder }, { status: 201 });
}
