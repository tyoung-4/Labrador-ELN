import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest } from "@/lib/auth";
import { saveFile, deleteFile } from "@/lib/storage";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

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
  const grouped: Record<string, typeof files> = {};
  for (const f of files) {
    (grouped[f.stepId] ??= []).push(f);
  }
  return NextResponse.json(grouped);
}

// ── POST — upload a file (multipart/form-data: file, stepId) and record it ───
export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const stepId = String(form.get("stepId") ?? "").trim();

    if (!(file instanceof File) || !stepId) {
      return NextResponse.json({ error: "file and stepId are required" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 400 });
    }

    const actor = await getActorFromRequest(req);
    const uploadedBy = String(form.get("uploadedBy") ?? "").trim() || actor.id;

    const timestamp = Date.now();
    const safeName = (file.name || "file").replace(/[^a-zA-Z0-9._\-()\s]/g, "_");
    const fileKey = `runs/${runId}/${stepId}/${timestamp}-${safeName}`;
    const mimeType = file.type || "application/octet-stream";

    const buffer = Buffer.from(await file.arrayBuffer());
    await saveFile(fileKey, buffer, mimeType);

    const record = await prisma.runStepFile.create({
      data: { runId, stepId, fileName: file.name || safeName, fileKey, fileSize: file.size, mimeType, uploadedBy },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error(`POST /api/runs/${runId}/files failed:`, error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
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
  if (!file || file.runId !== runId) return new NextResponse(null, { status: 404 });

  const updated = await prisma.runStepFile.update({ where: { id: fileId }, data: { notes } });
  return NextResponse.json(updated);
}

// ── DELETE — remove file from storage and DB ─────────────────────────────────
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const body = await req.json().catch(() => ({}));
  const { fileId } = body as { fileId?: string };

  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  const file = await prisma.runStepFile.findUnique({ where: { id: fileId } });
  if (!file || file.runId !== runId) return new NextResponse(null, { status: 404 });

  await deleteFile(file.fileKey);
  await prisma.runStepFile.delete({ where: { id: fileId } });
  return new NextResponse(null, { status: 204 });
}
