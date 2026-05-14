import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string; fileId: string }> },
) {
  const { runId, fileId } = await params;

  const file = await prisma.runStepFile.findUnique({ where: { id: fileId } });
  if (!file || file.runId !== runId) {
    return new NextResponse(null, { status: 404 });
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: file.fileKey,
    ResponseContentDisposition: `attachment; filename="${file.fileName}"`,
  });
  const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 hour

  return NextResponse.json({ url });
}
