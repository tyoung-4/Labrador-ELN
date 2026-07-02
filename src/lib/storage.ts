import { promises as fs } from "fs";
import path from "path";

// Pluggable file storage for run-step attachments.
//   • "local" (default) — files live on the server's disk under UPLOAD_DIR, so
//     the app works fully offline. Downloads are streamed by the server.
//   • "r2" — Cloudflare R2 (S3 API); used only if STORAGE_BACKEND=r2.
//
// The client never talks to storage directly — it uploads/downloads through the
// app, so the backend is transparent and offline-friendly.

export type StorageBackend = "local" | "r2";

export const STORAGE_BACKEND: StorageBackend =
  process.env.STORAGE_BACKEND === "r2" ? "r2" : "local";

const LOCAL_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

function localPath(key: string): string {
  // Prevent path traversal — keys are app-generated, but be defensive.
  const safe = key.replace(/\.\.(\/|\\|$)/g, "");
  return path.join(LOCAL_DIR, safe);
}

export async function saveFile(key: string, data: Buffer, mime: string): Promise<void> {
  if (STORAGE_BACKEND === "r2") {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { r2Client, R2_BUCKET } = await import("@/lib/r2");
    await r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: data, ContentType: mime }));
    return;
  }
  const full = localPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function readFile(key: string): Promise<Buffer> {
  if (STORAGE_BACKEND === "r2") {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { r2Client, R2_BUCKET } = await import("@/lib/r2");
    const res = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  return fs.readFile(localPath(key));
}

export async function deleteFile(key: string): Promise<void> {
  if (STORAGE_BACKEND === "r2") {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const { r2Client, R2_BUCKET } = await import("@/lib/r2");
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return;
  }
  await fs.unlink(localPath(key)).catch(() => {});
}
