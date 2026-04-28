import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ELN users — kept in sync with AppTopNav
const ELN_USERS = [
  { id: "finn-user",  name: "Finn" },
  { id: "jake-user",  name: "Jake" },
  { id: "admin-user", name: "Admin" },
];

type EntityType = "reagent" | "cell_line" | "plasmid" | "protein_stock";

async function markEntity(
  entityType: EntityType,
  entityId: string,
  markedBy: string,
  markedNote: string | undefined
) {
  const now = new Date();
  const data = { markedForArchive: true, markedBy, markedNote: markedNote ?? null, markedAt: now };

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

const ENTITY_LABELS: Record<EntityType, string> = {
  reagent: "Reagent",
  cell_line: "Cell Line",
  plasmid: "Plasmid",
  protein_stock: "Protein Stock",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityType, entityId, note } = body as {
      entityType: EntityType;
      entityId: string;
      note?: string;
    };

    const markedByName = req.headers.get("x-user-name") ?? "Unknown";

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
    }

    const result = await markEntity(entityType, entityId, markedByName, note);
    const entityName = (result as { name: string }).name;

    // Notify all users (including the marker — so admin can see the request)
    const label = ENTITY_LABELS[entityType];
    await prisma.dashboardNotification.createMany({
      data: ELN_USERS.map((u) => ({
        userId: u.id,
        type: "ARCHIVE_REQUEST",
        entityType,
        entityId,
        entityName,
        message: `${label} "${entityName}" has been flagged for archive by ${markedByName}.`,
        fromUser: markedByName,
        note: note ?? null,
      })),
    });

    return NextResponse.json({ ok: true, entityName });
  } catch (error) {
    console.error("POST /api/inventory/mark-for-archive failed:", error);
    return NextResponse.json({ error: "Mark for archive failed" }, { status: 500 });
  }
}
