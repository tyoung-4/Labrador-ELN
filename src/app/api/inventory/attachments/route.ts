import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";

/**
 * POST /api/inventory/attachments
 *
 * Accepts multipart/form-data with:
 *   - file: File
 *   - reagentLotId?:      string
 *   - cellLinePassageId?: string
 *   - plasmidPrepId?:     string
 *
 * Exactly one of the FK fields must be provided.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const reagentLotId      = (formData.get("reagentLotId")      as string) || null;
    const cellLinePassageId = (formData.get("cellLinePassageId") as string) || null;
    const plasmidPrepId     = (formData.get("plasmidPrepId")     as string) || null;

    if (!reagentLotId && !cellLinePassageId && !plasmidPrepId) {
      return NextResponse.json({ error: "A parent batch ID is required" }, { status: 400 });
    }

    // Determine a folder key from the FK
    const folderKey = reagentLotId ?? cellLinePassageId ?? plasmidPrepId!;
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, "_").trim();
    const uuid = crypto.randomUUID();
    const storageFilename = `${uuid}-${safeFilename}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "inventory", folderKey);
    await mkdir(uploadDir, { recursive: true });

    const fsPath = path.join(uploadDir, storageFilename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fsPath, buffer);

    const publicPath = `/uploads/inventory/${folderKey}/${storageFilename}`;

    const attachment = await prisma.inventoryAttachment.create({
      data: {
        filename:          file.name,
        mime:              file.type || "application/octet-stream",
        size:              buffer.length,
        path:              publicPath,
        reagentLotId:      reagentLotId      || null,
        cellLinePassageId: cellLinePassageId || null,
        plasmidPrepId:     plasmidPrepId     || null,
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory/attachments failed:", error);
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : undefined;
    return NextResponse.json({ error: "Failed to upload file", detail }, { status: 500 });
  }
}
