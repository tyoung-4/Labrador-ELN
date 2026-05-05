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
            { species: { contains: search, mode: "insensitive" as const } },
            { tissue: { contains: search, mode: "insensitive" as const } },
            { notes: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : { isArchived: false };

    const items = await prisma.cellLine.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { researchNotes: true } } },
    });

    if (items.length === 0) return NextResponse.json([]);

    const ids = items.map((i) => i.id);

    // Passage summary
    const passageSummaries = await prisma.cellLinePassage.groupBy({
      by: ["cellLineId"],
      where: { cellLineId: { in: ids } },
      _count: { _all: true },
      _sum: { vialCount: true },
    });
    const passageSummaryMap = new Map(
      passageSummaries.map((s) => [
        s.cellLineId,
        { count: s._count._all, totalVials: s._sum.vialCount ?? 0 },
      ])
    );

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
      passageSummary: passageSummaryMap.get(i.id) ?? { count: 0, totalVials: 0 },
      tagAssignments: tagMap.get(i.id) ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/inventory/celllines failed:", error);
    return NextResponse.json({ error: "Failed to load cell lines" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const item = await prisma.cellLine.create({ data });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory/celllines failed:", error);
    return NextResponse.json({ error: "Failed to create cell line" }, { status: 500 });
  }
}
