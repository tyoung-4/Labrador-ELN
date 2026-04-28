import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ELN users — kept in sync with AppTopNav
const ELN_USERS = [
  { id: "finn-user",  name: "Finn" },
  { id: "jake-user",  name: "Jake" },
  { id: "admin-user", name: "Admin" },
];

type EntityType = "reagent" | "cell_line" | "plasmid" | "protein_stock";

async function archiveEntity(
  entityType: EntityType,
  entityId: string,
  archivedBy: string,
  archiveReason: string | undefined
) {
  const now = new Date();
  const data = { isArchived: true, archivedAt: now, archivedBy, archiveReason: archiveReason ?? null, markedForArchive: false, markedBy: null, markedNote: null, markedAt: null };

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
    const { entityType, entityId, reason } = body as {
      entityType: EntityType;
      entityId: string;
      reason?: string;
    };

    const archivedByName = req.headers.get("x-user-name") ?? "Unknown";

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
    }

    const result = await archiveEntity(entityType, entityId, archivedByName, reason);
    const entityName = (result as { name: string }).name;

    // Notify all other users
    const label = ENTITY_LABELS[entityType];
    const otherUsers = ELN_USERS.filter((u) => u.name !== archivedByName);
    if (otherUsers.length > 0) {
      await prisma.dashboardNotification.createMany({
        data: otherUsers.map((u) => ({
          userId: u.id,
          type: "ARCHIVED",
          entityType,
          entityId,
          entityName,
          message: `${label} "${entityName}" was archived by ${archivedByName}.`,
          fromUser: archivedByName,
          note: reason ?? null,
        })),
      });
    }

    return NextResponse.json({ ok: true, entityName });
  } catch (error) {
    console.error("POST /api/inventory/archive failed:", error);
    return NextResponse.json({ error: "Archive failed" }, { status: 500 });
  }
}
