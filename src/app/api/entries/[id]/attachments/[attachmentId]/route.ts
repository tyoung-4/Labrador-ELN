import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string; attachmentId: string }> | { id: string; attachmentId: string };
};

async function getParams(context: RouteContext) {
  return await context.params;
}

// ─── DELETE — remove an attachment ────────────────────────────────────────────

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: entryId, attachmentId } = await getParams(context);

  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) return new NextResponse(null, { status: 404 });
    if (attachment.entryId !== entryId) return new NextResponse(null, { status: 404 });

    // Remove file from disk (best-effort — don't fail if file is already gone)
    const fsPath = path.join(process.cwd(), "public", attachment.path);
    await unlink(fsPath).catch(() => {});

    await prisma.attachment.delete({ where: { id: attachmentId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const isMissing =
      typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
    if (isMissing) return new NextResponse(null, { status: 404 });
    console.error(`DELETE /api/entries/${entryId}/attachments/${attachmentId} failed:`, error);
    return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 });
  }
}
