import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest, canEditEntity } from "@/lib/auth";
import { validateAnnotationInput, buildAnnotationData } from "@/lib/antibodyValidation";

// Resolve the parent antibody's owner and confirm the annotation belongs to it.
async function loadOwner(antibodyId: string, annotationId: string) {
  const annotation = await prisma.antibodyAnnotation.findFirst({
    where: { id: annotationId, antibodyId },
    select: { id: true, antibody: { select: { owner: true } } },
  });
  return annotation ? { exists: true, owner: annotation.antibody.owner } : { exists: false, owner: "" };
}

// PATCH /api/antibodies/[id]/annotations/[annotationId] — same validation as POST.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> },
) {
  const { id, annotationId } = await params;
  const actor = await getActorFromRequest(req);

  const { exists, owner } = await loadOwner(id, annotationId);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditEntity(actor, owner)) {
    return NextResponse.json({ error: "Not allowed to edit this antibody" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const check = validateAnnotationInput(body);
  if (!check.valid) return NextResponse.json({ error: check.error }, { status: 400 });

  const annotation = await prisma.antibodyAnnotation.update({
    where: { id: annotationId },
    data: buildAnnotationData(body as Record<string, unknown>, actor.name),
  });
  return NextResponse.json({ success: true, annotation });
}

// DELETE /api/antibodies/[id]/annotations/[annotationId] — owner or Admin.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> },
) {
  const { id, annotationId } = await params;
  const actor = await getActorFromRequest(req);

  const { exists, owner } = await loadOwner(id, annotationId);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditEntity(actor, owner)) {
    return NextResponse.json({ error: "Not allowed to edit this antibody" }, { status: 403 });
  }

  await prisma.antibodyAnnotation.delete({ where: { id: annotationId } });
  return NextResponse.json({ success: true });
}
