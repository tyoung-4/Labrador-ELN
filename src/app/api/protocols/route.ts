import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PROTOCOL_TECHNIQUES } from "@/models/entry";

type Actor = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};

function getActorFromRequest(request: Request): Actor {
  const headerId   = request.headers.get("x-user-id")?.trim();
  const headerName = request.headers.get("x-user-name")?.trim();
  const headerRole = request.headers.get("x-user-role")?.trim().toUpperCase();

  const name   = headerName || "Finn";
  const safeId = headerId || `user-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "member"}`;
  const role: "ADMIN" | "MEMBER" = headerRole === "ADMIN" ? "ADMIN" : "MEMBER";

  return { id: safeId, name, email: `${safeId}@local.eln`, role };
}

async function ensureActor(actor: Actor) {
  return prisma.user.upsert({
    where:  { id: actor.id },
    create: { id: actor.id, name: actor.name, email: actor.email, role: actor.role },
    update: { name: actor.name, role: actor.role },
  });
}

/**
 * POST /api/protocols
 * Creates a new Protocol entry via the creation modal.
 * Body: { name: string, technique: string, shortDescription?: string }
 * Returns the created Entry (same shape as GET /api/entries/:id).
 */
export async function POST(request: Request) {
  try {
    const actor = getActorFromRequest(request);
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

    // Uniqueness check (case-insensitive) against existing PROTOCOL entries
    const existing = await prisma.entry.findFirst({
      where: {
        entryType: "PROTOCOL",
        title: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A protocol with this name already exists." },
        { status: 409 }
      );
    }

    // Create Entry + Protocol row atomically
    const entry = await prisma.entry.create({
      data: {
        title:       name,
        description: shortDescription,
        technique,
        entryType:   "PROTOCOL",
        body:        "",
        typedData:   { typed: { _semVer: "1.0" } },
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
