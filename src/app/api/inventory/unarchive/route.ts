import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type EntityType = "reagent" | "cell_line" | "plasmid" | "protein_stock";

async function unarchiveEntity(entityType: EntityType, entityId: string) {
  const data = { isArchived: false, archivedAt: null, archivedBy: null, archiveReason: null };

  switch (entityType) {
    case "reagent":
      return prisma.inventoryReagent.update({ where: { id: entityId }, data, select: { name: true } });
    case "cell_line":
      return prisma.cellLine.update({ where: { id: entityId }, data, select: { name: true } });
    case "plasmid":
      return prisma.plasmid.update({ where: { id: entityId }, data, select: { name: true } });
    case "protein_stock":
      return prisma.proteinStock.update({ where: { id: entityId }, data, select: { name: true } });
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityType, entityId } = body as { entityType: EntityType; entityId: string };

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
    }

    const result = await unarchiveEntity(entityType, entityId);
    return NextResponse.json({ ok: true, entityName: (result as { name: string }).name });
  } catch (error) {
    console.error("POST /api/inventory/unarchive failed:", error);
    return NextResponse.json({ error: "Unarchive failed" }, { status: 500 });
  }
}
