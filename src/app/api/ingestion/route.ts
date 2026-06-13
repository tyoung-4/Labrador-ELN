import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { IngestionEntryKind } from "@/config/entryTypes";
import { getActorFromRequest, ensureActor } from "@/lib/auth";

/** GET: list all ingestion entries (entryKind not null). */
export async function GET() {
  try {
    const entries = await prisma.entry.findMany({
      where: { entryKind: { not: null } },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, role: true } },
        attachments: true,
      },
    });
    return NextResponse.json(entries);
  } catch (error) {
    console.error("GET /api/ingestion failed:", error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to load ingestion entries", detail }, { status: 500 });
  }
}

/** POST: create a new ingestion entry (metadata only; files via upload route). */
export async function POST(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    await ensureActor(actor);

    const payload = await request.json().catch(() => ({}));
    const kind = payload.entryKind as IngestionEntryKind | undefined;
    if (kind !== "EXPERIMENTAL_DATA" && kind !== "PLASMID_MAP") {
      return NextResponse.json({ error: "Invalid entry type. Use EXPERIMENTAL_DATA or PLASMID_MAP." }, { status: 400 });
    }

    const title =
      kind === "PLASMID_MAP"
        ? String(payload.plasmidName ?? "").trim() || "Unnamed plasmid"
        : String(payload.title ?? "").trim() || "Untitled";
    const entryDate = payload.entryDate ? new Date(payload.entryDate) : new Date();

    const created = await prisma.entry.create({
      data: {
        title,
        description: "",
        technique: "General",
        body: "",
        authorId: actor.id,
        entryKind: kind,
        operator: String(payload.operator ?? "").trim() || null,
        runReference: kind === "EXPERIMENTAL_DATA" ? String(payload.runReference ?? "").trim() || null : null,
        plasmidName: kind === "PLASMID_MAP" ? String(payload.plasmidName ?? "").trim() || null : null,
        bacterialStrain: kind === "PLASMID_MAP" ? String(payload.bacterialStrain ?? "").trim() || null : null,
        selectionMarker: kind === "PLASMID_MAP" ? String(payload.selectionMarker ?? "").trim() || null : null,
        notes: String(payload.notes ?? "").trim() || null,
        entryDate,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        attachments: true,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/ingestion failed:", error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to create ingestion entry", detail }, { status: 500 });
  }
}
