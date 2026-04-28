import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export interface ArchivedItem {
  id: string;
  name: string;
  entityType: "reagent" | "cell_line" | "plasmid" | "protein_stock";
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
  location: string | null;
  owner: string | null;
  notes: string | null;
  // Optional type-specific fields for display
  category?: string;       // reagent
  species?: string | null; // cell_line
  backbone?: string | null; // plasmid
  concentration?: number | null; // protein_stock
  concUnit?: string | null;      // protein_stock
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";

    const searchFilter = search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {};

    const [reagents, cellLines, plasmids, proteinStocks] = await Promise.all([
      prisma.inventoryReagent.findMany({
        where: { isArchived: true, ...searchFilter },
        orderBy: { archivedAt: "desc" },
        select: { id: true, name: true, category: true, archivedAt: true, archivedBy: true, archiveReason: true, location: true, owner: true, notes: true },
      }),
      prisma.cellLine.findMany({
        where: { isArchived: true, ...searchFilter },
        orderBy: { archivedAt: "desc" },
        select: { id: true, name: true, species: true, archivedAt: true, archivedBy: true, archiveReason: true, location: true, owner: true, notes: true },
      }),
      prisma.plasmid.findMany({
        where: { isArchived: true, ...searchFilter },
        orderBy: { archivedAt: "desc" },
        select: { id: true, name: true, backbone: true, archivedAt: true, archivedBy: true, archiveReason: true, location: true, owner: true, notes: true },
      }),
      prisma.proteinStock.findMany({
        where: { isArchived: true, ...searchFilter },
        orderBy: { archivedAt: "desc" },
        select: { id: true, name: true, concentration: true, concUnit: true, archivedAt: true, archivedBy: true, archiveReason: true, location: true, owner: true, notes: true },
      }),
    ]);

    const items: ArchivedItem[] = [
      ...reagents.map((r) => ({ ...r, entityType: "reagent" as const, archivedAt: r.archivedAt?.toISOString() ?? null })),
      ...cellLines.map((r) => ({ ...r, entityType: "cell_line" as const, archivedAt: r.archivedAt?.toISOString() ?? null })),
      ...plasmids.map((r) => ({ ...r, entityType: "plasmid" as const, archivedAt: r.archivedAt?.toISOString() ?? null })),
      ...proteinStocks.map((r) => ({ ...r, entityType: "protein_stock" as const, archivedAt: r.archivedAt?.toISOString() ?? null })),
    ];

    // Sort by archivedAt desc (most recently archived first)
    items.sort((a, b) => {
      if (!a.archivedAt && !b.archivedAt) return 0;
      if (!a.archivedAt) return 1;
      if (!b.archivedAt) return -1;
      return new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime();
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/inventory/archived failed:", error);
    return NextResponse.json({ error: "Failed to load archived items" }, { status: 500 });
  }
}
