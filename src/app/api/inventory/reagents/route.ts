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
            { category: { contains: search, mode: "insensitive" as const } },
            { location: { contains: search, mode: "insensitive" as const } },
            { vendor: { contains: search, mode: "insensitive" as const } },
            { notes: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : { isArchived: false };

    const reagents = await prisma.inventoryReagent.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { researchNotes: true, usageEvents: true } },
      },
    });

    if (reagents.length === 0) return NextResponse.json([]);

    const ids = reagents.map((r) => r.id);

    // Lot summary (active lots only)
    const lotSummaries = await prisma.reagentLot.groupBy({
      by: ["reagentId"],
      where: { reagentId: { in: ids }, isArchived: false },
      _count: { _all: true },
      _sum: { quantity: true },
    });
    const lotSummaryMap = new Map(
      lotSummaries.map((s) => [
        s.reagentId,
        { count: s._count._all, totalQuantity: s._sum.quantity ?? 0 },
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

    const result = reagents.map((r) => ({
      ...r,
      lotSummary: lotSummaryMap.get(r.id) ?? { count: 0, totalQuantity: 0 },
      tagAssignments: tagMap.get(r.id) ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/inventory/reagents failed:", error);
    return NextResponse.json({ error: "Failed to load reagents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const reagent = await prisma.inventoryReagent.create({ data });
    return NextResponse.json(reagent, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory/reagents failed:", error);
    return NextResponse.json({ error: "Failed to create reagent" }, { status: 500 });
  }
}
