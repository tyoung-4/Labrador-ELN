import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET } from "@/lib/r2";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const body = await req.json().catch(() => ({}));
  const { stepId, fileName, fileSize, mimeType } = body as {
    stepId?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };

  if (!stepId || !fileName || !mimeType) {
    return NextResponse.json({ error: "stepId, fileName, and mimeType are required" }, { status: 400 });
  }
  if (typeof fileSize === "number" && fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 400 });
  }

  const timestamp = Date.now();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._\-()\s]/g, "_");
  const fileKey = `runs/${runId}/${stepId}/${timestamp}-${safeFileName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: fileKey,
    ContentType: mimeType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 }); // 5 min

  return NextResponse.json({ uploadUrl, fileKey });
}
