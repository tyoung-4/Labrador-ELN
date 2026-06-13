import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest, ensureActor } from "@/lib/auth";

type RouteContext = { params: Promise<{ entryId: string }> | { entryId: string } };

/**
 * POST /api/protocols/:id/draft
 * Creates a draft fork of the published entry `id`.
 * Returns the new draft Entry.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { entryId: id } = await Promise.resolve(params);
  try {
    const actor = await getActorFromRequest(request);
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
