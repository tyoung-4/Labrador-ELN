import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PROTOCOL_TECHNIQUES } from "@/models/entry";
import { getActorFromRequest, ensureActor } from "@/lib/auth";

/**
 * POST /api/protocols
 * Creates a new Protocol entry via the creation modal.
 * Body: { name: string, technique: string, shortDescription?: string }
 * Returns the created Entry (same shape as GET /api/entries/:id).
 */
export async function POST(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    await ensureActor(actor);

    const payload = await request.json().catch(() => ({}));

    const name             = String(payload.name ?? "").trim();
    const technique        = String(payload.technique ?? "").trim();
    const shortDescription = String(payload.shortDescription ?? "").trim().slice(0, 100);

    if (!name) {
      return NextResponse.json({ error: "Protocol name is required." }, { status: 400 });
    }
    if (!technique) {
      return NextResponse.json({ error: "Technique is required." }, { status: 400 });
    }
    if (!PROTOCOL_TECHNIQUES.includes(technique as (typeof PROTOCOL_TECHNIQUES)[number])) {
      return NextResponse.json({ error: "Invalid technique value." }, { status: 400 });
    }

    // Uniqueness check (case-insensitive) against existing PUBLISHED PROTOCOL entries only
    const existing = await prisma.entry.findFirst({
      where: {
        entryType: "PROTOCOL",
        status: "PUBLISHED",
        title: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A published protocol with this name already exists." },
        { status: 409 }
      );
    }

    // Create Entry + Protocol row atomically — starts as DRAFT at v0
    const entry = await prisma.entry.create({
      data: {
        title:       name,
        description: shortDescription,
        technique,
        entryType:   "PROTOCOL",
        body:        "",
        typedData:   { typed: { _semVer: "0" } },
        status:      "DRAFT",
        authorId:    actor.id,
        version:     1,
        protocol: {
          create: {
            name,
            technique,
            ...(shortDescription ? { shortDescription } : {}),
          },
        },
      },
      include: {
        author:      { select: { id: true, name: true, role: true } },
        attachments: { orderBy: { createdAt: "asc" } },
        linkedRun:   { select: { id: true, title: true, status: true, createdAt: true } },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    // Catch DB-level unique constraint violation on Protocol.name
    const isUniqueViolation =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002";
    if (isUniqueViolation) {
      return NextResponse.json(
        { error: "A protocol with this name already exists." },
        { status: 409 }
      );
    }

    console.error("POST /api/protocols failed:", error);
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : undefined;
    return NextResponse.json({ error: "Failed to create protocol.", detail }, { status: 500 });
  }
}
