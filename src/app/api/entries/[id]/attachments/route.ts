import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

async function getEntryId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return resolved.id;
}

// ─── GET — list attachments for an entry ──────────────────────────────────────

export async function GET(_request: Request, context: RouteContext) {
  const entryId = await getEntryId(context);
  try {
    const attachments = await prisma.attachment.findMany({
      where: { entryId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(attachments);
  } catch (error) {
    console.error(`GET /api/entries/${entryId}/attachments failed:`, error);
    return NextResponse.json({ error: "Failed to load attachments" }, { status: 500 });
  }
}

// ─── POST — upload a file for an entry ────────────────────────────────────────

export async function POST(request: Request, context: RouteContext) {
  const entryId = await getEntryId(context);

  try {
    // Verify entry exists
    const entry = await prisma.entry.findUnique({ where: { id: entryId }, select: { id: true } });
    if (!entry) return new NextResponse(null, { status: 404 });

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Sanitize filename and build storage path
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, "_").trim();
    const uuid = crypto.randomUUID();
    const storageFilename = `${uuid}-${safeFilename}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", entryId);
    await mkdir(uploadDir, { recursive: true });

    const fsPath = path.join(uploadDir, storageFilename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fsPath, buffer);

    const publicPath = `/uploads/${entryId}/${storageFilename}`;

    const attachment = await prisma.attachment.create({
      data: {
        entryId,
        filename: file.name,
        mime: file.type || "application/octet-stream",
        size: buffer.length,
        path: publicPath,
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error(`POST /api/entries/${entryId}/attachments failed:`, error);
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : undefined;
    return NextResponse.json({ error: "Failed to upload file", detail }, { status: 500 });
  }
}
