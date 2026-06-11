import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeEntityType, resolveEntities } from "@/lib/projectAccess";

type RouteContext = { params: Promise<{ name: string }> | { name: string } };

async function getName(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return decodeURIComponent(resolved.name);
}

type ResultRow = {
  entityType: string;
  entityId: string;
  name: string;
  owner: string | null;
  date: string | null;
  projects: Array<{ id: string; name: string; color: string }>;
};

// GET /api/tags/[name]/items?entityType=&owner=&project=&keyword=
// Returns every item tagged with this tag, grouped into protocols / runs /
// inventoryItems / knowledgeHub, plus the owner+project option lists for the
// filter bar. Filters are applied server-side when present (the page may also
// filter the returned set client-side).
export async function GET(request: NextRequest, context: RouteContext) {
  const name = await getName(context);
  const params = new URL(request.url).searchParams;
  const fEntityType = params.get("entityType") ?? "";
  const fOwner = (params.get("owner") ?? "").trim().toLowerCase();
  const fProject = (params.get("project") ?? "").trim();
  const fKeyword = (params.get("keyword") ?? "").trim().toLowerCase();

  try {
    const tag = await prisma.tag.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true, type: true, color: true },
    });
    if (!tag) {
      return NextResponse.json({
        tag: { name, found: false },
        total: 0,
        protocols: [], runs: [], inventoryItems: [], knowledgeHub: [],
        owners: [], projects: [],
      });
    }

    const assignments = await prisma.tagAssignment.findMany({
      where: { tagId: tag.id },
      select: { entityType: true, entityId: true },
    });

    // Resolve display metadata per canonical type.
    const idsByType = new Map<string, string[]>();
    for (const a of assignments) {
      const et = normalizeEntityType(a.entityType);
      const list = idsByType.get(et) ?? [];
      list.push(a.entityId);
      idsByType.set(et, list);
    }

    // Project badges: which PROJECT tags each (entityType,entityId) belongs to.
    const allPairs = assignments.map((a) => ({ et: normalizeEntityType(a.entityType), id: a.entityId }));
    const projectAssignments = allPairs.length
      ? await prisma.tagAssignment.findMany({
          where: {
            entityId: { in: [...new Set(allPairs.map((p) => p.id))] },
            tag: { type: "PROJECT" },
          },
          select: { entityType: true, entityId: true, tag: { select: { id: true, name: true, color: true } } },
        })
      : [];
    const projectMap = new Map<string, Array<{ id: string; name: string; color: string }>>();
    for (const pa of projectAssignments) {
      const key = `${normalizeEntityType(pa.entityType)}::${pa.entityId}`;
      const list = projectMap.get(key) ?? [];
      list.push(pa.tag);
      projectMap.set(key, list);
    }

    const rows: ResultRow[] = [];
    for (const [et, ids] of idsByType) {
      const resolved = await resolveEntities(et, ids);
      for (const id of ids) {
        const meta = resolved.get(id);
        rows.push({
          entityType: et,
          entityId: id,
          name: meta?.name ?? id,
          owner: meta?.owner ?? null,
          date: meta?.date ? meta.date.toISOString() : null,
          projects: projectMap.get(`${et}::${id}`) ?? [],
        });
      }
    }

    // Build filter option lists before applying filters.
    const owners = [...new Set(rows.map((r) => r.owner).filter((o): o is string => !!o))].sort();
    const projects = [
      ...new Map(rows.flatMap((r) => r.projects).map((p) => [p.id, p])).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));

    // Apply server-side filters.
    const filtered = rows.filter((r) => {
      if (fEntityType && normalizeEntityType(fEntityType) !== r.entityType) return false;
      if (fOwner && (r.owner ?? "").toLowerCase() !== fOwner) return false;
      if (fProject && !r.projects.some((p) => p.id === fProject || p.name.toLowerCase() === fProject.toLowerCase())) return false;
      if (fKeyword && !r.name.toLowerCase().includes(fKeyword)) return false;
      return true;
    });

    const INVENTORY = new Set(["PLASMID", "CELL_LINE", "PROTEIN_STOCK", "REAGENT"]);
    return NextResponse.json({
      tag: { id: tag.id, name: tag.name, type: tag.type, color: tag.color, found: true },
      total: filtered.length,
      protocols: filtered.filter((r) => r.entityType === "ENTRY"),
      runs: filtered.filter((r) => r.entityType === "RUN"),
      inventoryItems: filtered.filter((r) => INVENTORY.has(r.entityType)),
      knowledgeHub: filtered.filter((r) => r.entityType === "KNOWLEDGE_HUB"),
      owners,
      projects,
    });
  } catch (error) {
    console.error(`GET /api/tags/${name}/items failed:`, error);
    return NextResponse.json({ error: "Failed to load tagged items" }, { status: 500 });
  }
}
