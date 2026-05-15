import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Ctx = { params: Promise<{ fileId: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: Ctx) {
  const { fileId } = await params;
  const annotation = await prisma.fileAnnotation.findUnique({
    where: { runStepFileId: fileId },
    include: {
      gelLanes: { orderBy: { laneNumber: "asc" } },
      peaks: { orderBy: { peakNumber: "asc" } },
    },
  });
  return NextResponse.json(annotation ?? null);
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: Ctx) {
  const { fileId } = await params;
  const body = await req.json().catch(() => ({})) as {
    fileType?: string;
    notes?: string;
    createdById?: string;
  };

  const existing = await prisma.fileAnnotation.findUnique({ where: { runStepFileId: fileId } });
  if (existing) return NextResponse.json({ error: "Annotation already exists" }, { status: 409 });

  const annotation = await prisma.fileAnnotation.create({
    data: {
      runStepFileId: fileId,
      fileType: body.fileType ?? "OTHER",
      notes: body.notes ?? "",
      createdById: body.createdById ?? "",
    },
    include: {
      gelLanes: true,
      peaks: true,
    },
  });
  return NextResponse.json(annotation, { status: 201 });
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(req: Request, { params }: Ctx) {
  const { fileId } = await params;
  const body = await req.json().catch(() => ({})) as { fileType?: string; notes?: string };

  const annotation = await prisma.fileAnnotation.update({
    where: { runStepFileId: fileId },
    data: {
      ...(body.fileType !== undefined && { fileType: body.fileType }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
    include: {
      gelLanes: { orderBy: { laneNumber: "asc" } },
      peaks: { orderBy: { peakNumber: "asc" } },
    },
  });
  return NextResponse.json(annotation);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: Ctx) {
  const { fileId } = await params;
  await prisma.fileAnnotation.delete({ where: { runStepFileId: fileId } });
  return new NextResponse(null, { status: 204 });
}
