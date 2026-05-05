import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ tagId: string }> | { tagId: string } };

async function getTagId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return resolved.tagId;
}

// PATCH /api/projects/[tagId]/short-tag
// Body: { shortTagId: string }
// Links an existing PROJECT-type tag as the short tag for the given project tag.
export async function PATCH(req: NextRequest, context: RouteContext) {
  const tagId = await getTagId(context);
  const body = (await req.json()) as { shortTagId: string };

  if (!body.shortTagId) {
    return NextResponse.json({ error: "shortTagId is required" }, { status: 400 });
  }

  // Verify the short tag exists and is type PROJECT
  const shortTag = await prisma.tag.findUnique({
    where: { id: body.shortTagId },
    select: { id: true, type: true, name: true },
  });

  if (!shortTag) {
    return NextResponse.json({ error: "Short tag not found" }, { status: 404 });
  }
  if (shortTag.type !== "PROJECT") {
    return NextResponse.json({ error: "Short tag must be of type PROJECT" }, { status: 400 });
  }

  // Update the parent project tag to point to the short tag
  const updated = await prisma.tag.update({
    where: { id: tagId },
    data: { shortTagId: body.shortTagId },
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      shortTagId: true,
      shortTag: { select: { id: true, name: true, color: true } },
    },
  });

  return NextResponse.json({ success: true, tag: updated });
}
