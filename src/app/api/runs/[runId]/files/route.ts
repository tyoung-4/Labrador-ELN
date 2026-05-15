import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import prisma from "@/lib/prisma";

// ── GET — all files for this run, grouped by stepId ──────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const files = await prisma.runStepFile.findMany({
    where: { runId },
    orderBy: { createdAt: "asc" },
  });

  // Group by stepId
  const grouped: Record<string, typeof files> = {};
  for (const f of files) {
    (grouped[f.stepId] ??= []).push(f);
  }
  return NextResponse.json(grouped);
}

// ── POST — confirm upload, create RunStepFile record ─────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const body = await req.json().catch(() => ({}));
  const { stepId, fileName, fileSize, mimeType, fileKey, uploadedBy } = body as {
    stepId?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    fileKey?: string;
    uploadedBy?: string;
  };

  if (!stepId || !fileName || !mimeType || !fileKey || !uploadedBy) {
    return NextResponse.json(
      { error: "stepId, fileName, mimeType, fileKey, and uploadedBy are required" },
      { status: 400 },
    );
  }

  const file = await prisma.runStepFile.create({
    data: {
      runId,
      stepId,
      fileName,
      fileKey,
      fileSize: fileSize ?? 0,
      mimeType,
      uploadedBy,
    },
  });
  return NextResponse.json(file, { status: 201 });
}

// ── PATCH — update notes on a file record ────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const body = await req.json().catch(() => ({}));
  const { fileId, notes } = body as { fileId?: string; notes?: string };

  if (!fileId || notes === undefined) {
    return NextResponse.json({ error: "fileId and notes are required" }, { status: 400 });
  }

  const file = await prisma.runStepFile.findUnique({ where: { id: fileId } });
  if (!file || file.runId !== runId) {
    return new NextResponse(null, { status: 404 });
  }

  const updated = await prisma.runStepFile.update({
    where: { id: fileId },
    data: { notes },
  });
  return NextResponse.json(updated);
}

// ── DELETE — remove file from R2 and DB ──────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const body = await req.json().catch(() => ({}));
  const { fileId } = body as { fileId?: string };

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const file = await prisma.runStepFile.findUnique({ where: { id: fileId } });
  if (!file || file.runId !== runId) {
    return new NextResponse(null, { status: 404 });
  }

  // Delete from R2 first, then DB (DB delete is idempotent if R2 fails)
  await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: file.fileKey }));
  await prisma.runStepFile.delete({ where: { id: fileId } });

  return new NextResponse(null, { status: 204 });
}
