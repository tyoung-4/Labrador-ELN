import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Actor = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};

type RouteContext = { params: Promise<{ entryId: string }> | { entryId: string } };

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
 * POST /api/protocols/:id/draft
 * Creates a draft fork of the published entry `id`.
 * Returns the new draft Entry.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { entryId: id } = await Promise.resolve(params);
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    const source = await prisma.entry.findUnique({ where: { id } });
    if (!source) return new NextResponse(null, { status: 404 });
    if (source.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Only published entries can be forked into a draft." }, { status: 400 });
    }

    // Check for an existing draft by this user for this entry
    const existingDraft = await prisma.entry.findFirst({
      where: { draftOfId: id, status: "DRAFT", authorId: actor.id },
      select: { id: true },
    });
    if (existingDraft) {
      return NextResponse.json(
        { error: "You already have a draft of this protocol.", draftId: existingDraft.id },
        { status: 409 }
      );
    }

    // Copy typedData, add _parentId for version family grouping on publish
    const sourceTypedData =
      source.typedData && typeof source.typedData === "object"
        ? (source.typedData as { typed?: Record<string, string>; custom?: string[] })
        : { typed: {}, custom: [] as string[] };

    const draftTypedData = {
      ...sourceTypedData,
      typed: {
        ...(sourceTypedData.typed ?? {}),
        _parentId: id, // links to published entry for version grouping on publish
      },
    };

    const draft = await prisma.entry.create({
      data: {
        title:       source.title,
        description: source.description,
        technique:   source.technique,
        entryType:   source.entryType,
        body:        source.body,
        typedData:   draftTypedData,
        status:      "DRAFT",
        draftOfId:   id,
        authorId:    actor.id,
        version:     1,
        allowNonSequential: source.allowNonSequential,
      },
      include: {
        author:    { select: { id: true, name: true, role: true } },
        attachments: { orderBy: { createdAt: "asc" } },
        linkedRun: { select: { id: true, title: true, status: true, createdAt: true } },
      },
    });

    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    console.error(`POST /api/protocols/[entryId]/draft failed:`, error);
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : undefined;
    return NextResponse.json({ error: "Failed to create draft.", detail }, { status: 500 });
  }
}
