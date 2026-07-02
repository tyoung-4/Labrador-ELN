import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readFile } from "@/lib/storage";

// GET /api/runs/[runId]/files/[fileId]/download
// Streams the stored file through the app (works with local disk or R2), so it
// downloads/renders without any external service.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string; fileId: string }> },
) {
  const { runId, fileId } = await params;
  const file = await prisma.runStepFile.findUnique({ where: { id: fileId } });
  if (!file || file.runId !== runId) return new NextResponse(null, { status: 404 });

  try {
    const data = await readFile(file.fileKey);
    const safeName = file.fileName.replace(/["\\\r\n]/g, "_");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(data.length),
      },
    });
  } catch (error) {
    console.error(`download ${fileId} failed:`, error);
    return new NextResponse(null, { status: 404 });
  }
}
