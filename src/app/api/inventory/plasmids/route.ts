import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const where = search
      ? {
          isArchived: false,
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { backbone: { contains: search, mode: "insensitive" as const } },
            { insert: { contains: search, mode: "insensitive" as const } },
            { location: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : { isArchived: false };

    const items = await prisma.plasmid.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { researchNotes: true } } },
    });

    if (items.length === 0) return NextResponse.json([]);

    const ids = items.map((i) => i.id);

    // Tag assignments
    const tagAssignments = await prisma.tagAssignment.findMany({
      where: { entityType: "INVENTORY", entityId: { in: ids } },
      include: { tag: true },
    });
    const tagMap = new Map<string, typeof tagAssignments>();
    for (const ta of tagAssignments) {
      if (!tagMap.has(ta.entityId)) tagMap.set(ta.entityId, []);
      tagMap.get(ta.entityId)!.push(ta);
    }

    const result = items.map((i) => ({
      ...i,
      tagAssignments: tagMap.get(i.id) ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/inventory/plasmids failed:", error);
    return NextResponse.json({ error: "Failed to load plasmids" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const item = await prisma.plasmid.create({ data });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory/plasmids failed:", error);
    return NextResponse.json({ error: "Failed to create plasmid" }, { status: 500 });
  }
}
