import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ tagId: string }> | { tagId: string } };

async function getTagId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return resolved.tagId;
}

async function loadPin(tagId: string) {
  return prisma.tag.findUnique({ where: { id: tagId }, select: { id: true, type: true, pinnedBy: true } });
}

// POST /api/projects/[tagId]/pin   Body: { operator }  — add operator to pinnedBy
export async function POST(request: NextRequest, context: RouteContext) {
  const tagId = await getTagId(context);
  try {
    const { operator } = (await request.json().catch(() => ({}))) as { operator?: string };
    const op = (operator ?? "").trim();
    if (!op) return NextResponse.json({ error: "operator is required" }, { status: 400 });

    const tag = await loadPin(tagId);
    if (!tag || tag.type !== "PROJECT") return new NextResponse(null, { status: 404 });

    const pinnedBy = tag.pinnedBy.includes(op) ? tag.pinnedBy : [...tag.pinnedBy, op];
    await prisma.tag.update({ where: { id: tagId }, data: { pinnedBy } });
    return NextResponse.json({ success: true, pinnedBy });
  } catch (error) {
    console.error(`POST /api/projects/${tagId}/pin failed:`, error);
    return NextResponse.json({ error: "Failed to pin project" }, { status: 500 });
  }
}

// DELETE /api/projects/[tagId]/pin   Body: { operator }  — remove operator from pinnedBy
export async function DELETE(request: NextRequest, context: RouteContext) {
  const tagId = await getTagId(context);
  try {
    const { operator } = (await request.json().catch(() => ({}))) as { operator?: string };
    const op = (operator ?? "").trim();
    if (!op) return NextResponse.json({ error: "operator is required" }, { status: 400 });

    const tag = await loadPin(tagId);
    if (!tag || tag.type !== "PROJECT") return new NextResponse(null, { status: 404 });

    const pinnedBy = tag.pinnedBy.filter((p) => p !== op);
    await prisma.tag.update({ where: { id: tagId }, data: { pinnedBy } });
    return NextResponse.json({ success: true, pinnedBy });
  } catch (error) {
    console.error(`DELETE /api/projects/${tagId}/pin failed:`, error);
    return NextResponse.json({ error: "Failed to unpin project" }, { status: 500 });
  }
}
