import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest, canEditEntity } from "@/lib/auth";
import { validateAnnotationInput, buildAnnotationData } from "@/lib/antibodyValidation";

// GET /api/antibodies/[id]/annotations — ordered by chain, region, position.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const annotations = await prisma.antibodyAnnotation.findMany({
    where: { antibodyId: id },
    orderBy: [{ chain: "asc" }, { region: "asc" }, { position: "asc" }],
  });
  return NextResponse.json(annotations);
}

// POST /api/antibodies/[id]/annotations — add an annotation (owner or Admin).
// Validation is enforced server-side per annotation type.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActorFromRequest(req);

  const antibody = await prisma.antibody.findUnique({ where: { id }, select: { owner: true } });
  if (!antibody) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditEntity(actor, antibody.owner)) {
    return NextResponse.json({ error: "Not allowed to edit this antibody" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const check = validateAnnotationInput(body);
  if (!check.valid) return NextResponse.json({ error: check.error }, { status: 400 });

  const annotation = await prisma.antibodyAnnotation.create({
    data: { antibodyId: id, ...buildAnnotationData(body as Record<string, unknown>, actor.name) },
  });
  return NextResponse.json({ success: true, annotation }, { status: 201 });
}
