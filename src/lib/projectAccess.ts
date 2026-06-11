import prisma from "@/lib/prisma";

// ─── Project (Tag type=PROJECT) access + reconciliation helpers ──────────────
//
// This feature is reconciled onto the existing String/Tag architecture rather
// than the spec's Int-keyed `Project` model:
//   • "Project"  = Tag where type = "PROJECT"
//   • "ProjectItem" / "TagAssignment to a project" = TagAssignment whose tagId
//     points at a PROJECT-type Tag (entityId is a String — matches every
//     entity PK in this DB).
//   • Project-assignment notifications are stored as DashboardNotification rows
//     with type = "PROJECT_ASSIGNMENT" (no separate model).

export const PROJECT_ASSIGNMENT_NOTIFICATION_TYPE = "PROJECT_ASSIGNMENT";

// Canonical entityType values used by the project/tag endpoints. "ENTRY" backs
// the "Protocols" tab (protocols are Entry rows); "PROTOCOL" is accepted as an
// input alias and normalised to "ENTRY".
export const ENTITY_TYPES = [
  "ENTRY",
  "RUN",
  "PROTEIN_STOCK",
  "PLASMID",
  "CELL_LINE",
  "REAGENT",
  "KNOWLEDGE_HUB",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Normalise spec/legacy entityType aliases onto the canonical set. */
export function normalizeEntityType(raw: string): string {
  const v = (raw || "").toUpperCase().trim();
  if (v === "PROTOCOL") return "ENTRY";
  if (v === "REAGENT_STOCK" || v === "INVENTORY_ITEM" || v === "INVENTORY") return "REAGENT";
  if (v === "CELLLINE") return "CELL_LINE";
  if (v === "PROTEINSTOCK") return "PROTEIN_STOCK";
  return v;
}

type ProjectPrivacyShape = {
  isPrivate?: boolean | null;
  owner?: string | null;
  createdBy?: string | null;
  privateMembers?: string[] | null;
};

/**
 * Privacy predicate — a private project is only visible to its owner, its
 * creator, a listed private member, or an Admin. Public projects are visible
 * to everyone. `operator` is the requester's display name (case-insensitive).
 */
export function canViewProject(tag: ProjectPrivacyShape, operator: string | null | undefined): boolean {
  if (!tag.isPrivate) return true;
  const op = (operator ?? "").trim().toLowerCase();
  if (!op) return false;
  if (op === "admin") return true;
  if ((tag.owner ?? "").trim().toLowerCase() === op) return true;
  if ((tag.createdBy ?? "").trim().toLowerCase() === op) return true;
  return (tag.privateMembers ?? []).some((m) => m.trim().toLowerCase() === op);
}

/**
 * Returns true if the given entity (by canonical entityType + String id) is
 * assigned to at least one PROJECT-type tag.
 */
export async function entityHasProject(entityType: string, entityId: string): Promise<boolean> {
  const et = normalizeEntityType(entityType);
  const assignments = await prisma.tagAssignment.findMany({
    where: { entityType: et, entityId },
    select: { tag: { select: { type: true } } },
  });
  return assignments.some((a) => a.tag.type === "PROJECT");
}

/**
 * Creates a project-assignment nudge (DashboardNotification, type
 * PROJECT_ASSIGNMENT) for `operator` if the entity has no project assigned.
 * Never throws — notification failures must not block primary record creation.
 */
export async function maybeNotifyMissingProject(args: {
  entityType: string;
  entityId: string;
  entityName: string;
  operator: string;
}): Promise<void> {
  try {
    const has = await entityHasProject(args.entityType, args.entityId);
    if (has) return;
    const et = normalizeEntityType(args.entityType);
    // De-dupe: skip if an undismissed nudge already exists for this entity+operator
    const existing = await prisma.dashboardNotification.findFirst({
      where: {
        type: PROJECT_ASSIGNMENT_NOTIFICATION_TYPE,
        entityType: et,
        entityId: args.entityId,
        userId: args.operator,
        isRead: false,
      },
      select: { id: true },
    });
    if (existing) return;
    await prisma.dashboardNotification.create({
      data: {
        userId: args.operator,
        type: PROJECT_ASSIGNMENT_NOTIFICATION_TYPE,
        entityType: et,
        entityId: args.entityId,
        entityName: args.entityName,
        message: `${args.entityName} is missing a project assignment`,
        fromUser: "system",
      },
    });
  } catch (err) {
    console.error("maybeNotifyMissingProject failed (non-blocking):", err);
  }
}

/**
 * Resolve display metadata (name, owner, date) for a batch of entities of one
 * canonical entityType. Returns a Map keyed by entityId. Best-effort —
 * unknown/absent rows are simply omitted.
 */
export async function resolveEntities(
  entityType: string,
  ids: string[]
): Promise<Map<string, { name: string; owner: string | null; date: Date }>> {
  const out = new Map<string, { name: string; owner: string | null; date: Date }>();
  if (ids.length === 0) return out;
  const et = normalizeEntityType(entityType);

  if (et === "ENTRY") {
    const rows = await prisma.entry.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, updatedAt: true, author: { select: { name: true } } },
    });
    for (const r of rows) out.set(r.id, { name: r.title, owner: r.author?.name ?? null, date: r.updatedAt });
  } else if (et === "RUN") {
    const rows = await prisma.protocolRun.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, createdAt: true, operatorName: true, runner: { select: { name: true } } },
    });
    for (const r of rows) out.set(r.id, { name: r.title, owner: r.operatorName || r.runner?.name || null, date: r.createdAt });
  } else if (et === "PLASMID") {
    const rows = await prisma.plasmid.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, owner: true, updatedAt: true },
    });
    for (const r of rows) out.set(r.id, { name: r.name, owner: r.owner, date: r.updatedAt });
  } else if (et === "CELL_LINE") {
    const rows = await prisma.cellLine.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, owner: true, updatedAt: true },
    });
    for (const r of rows) out.set(r.id, { name: r.name, owner: r.owner, date: r.updatedAt });
  } else if (et === "PROTEIN_STOCK") {
    const rows = await prisma.proteinStock.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, owner: true, updatedAt: true },
    });
    for (const r of rows) out.set(r.id, { name: r.name, owner: r.owner, date: r.updatedAt });
  } else if (et === "REAGENT") {
    const rows = await prisma.inventoryReagent.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, owner: true, updatedAt: true },
    });
    for (const r of rows) out.set(r.id, { name: r.name, owner: r.owner, date: r.updatedAt });
  }
  // KNOWLEDGE_HUB: no backing model in schema — caller falls back to entityId.
  return out;
}
