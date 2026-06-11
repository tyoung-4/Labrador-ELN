import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { canViewProject, normalizeEntityType, resolveEntities } from "@/lib/projectAccess";

type RouteContext = { params: Promise<{ tagId: string }> | { tagId: string } };

async function getTagId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return resolved.tagId;
}

async function loadProject(tagId: string) {
  return prisma.tag.findUnique({
    where: { id: tagId },
    select: { id: true, type: true, isPrivate: true, owner: true, createdBy: true, privateMembers: true, shortTagId: true },
  });
}

// GET /api/projects/[tagId]/items?currentUser=
// Returns all assigned items grouped by canonical entityType, with counts.
export async function GET(request: NextRequest, context: RouteContext) {
  const tagId = await getTagId(context);
  const currentUser = new URL(request.url).searchParams.get("currentUser") ?? "";
  try {
    const project = await loadProject(tagId);
    if (!project || project.type !== "PROJECT") return new NextResponse(null, { status: 404 });
    if (!canViewProject(project, currentUser)) {
      return NextResponse.json({ error: "This project is private" }, { status: 403 });
    }

    const tagIds = [tagId, ...(project.shortTagId ? [project.shortTagId] : [])];
    const assignments = await prisma.tagAssignment.findMany({
      where: { tagId: { in: tagIds } },
      select: { entityType: true, entityId: true, assignedBy: true, assignedAt: true },
    });

    // Group ids by canonical entityType, then resolve display metadata.
    const idsByType = new Map<string, string[]>();
    for (const a of assignments) {
      const et = normalizeEntityType(a.entityType);
      const list = idsByType.get(et) ?? [];
      list.push(a.entityId);
      idsByType.set(et, list);
    }

    const grouped: Record<string, Array<{ entityId: string; name: string; owner: string | null; date: string | null; assignedBy: string; assignedAt: string }>> = {};
    const counts: Record<string, number> = {};
    for (const [et, ids] of idsByType) {
      const resolved = await resolveEntities(et, ids);
      const rows = assignments
        .filter((a) => normalizeEntityType(a.entityType) === et)
        .map((a) => {
          const meta = resolved.get(a.entityId);
          return {
            entityId: a.entityId,
            name: meta?.name ?? a.entityId,
            owner: meta?.owner ?? null,
            date: meta?.date ? meta.date.toISOString() : null,
            assignedBy: a.assignedBy,
            assignedAt: a.assignedAt.toISOString(),
          };
        });
      grouped[et] = rows;
      counts[et] = rows.length;
    }

    return NextResponse.json({ items: grouped, counts, total: assignments.length });
  } catch (error) {
    console.error(`GET /api/projects/${tagId}/items failed:`, error);
    return NextResponse.json({ error: "Failed to load project items" }, { status: 500 });
  }
}

// POST /api/projects/[tagId]/items
// Body: { entityType, entityId, assignedBy }  — assign an item (idempotent)
export async function POST(request: NextRequest, context: RouteContext) {
  const tagId = await getTagId(context);
  try {
    const body = (await request.json().catch(() => ({}))) as {
      entityType?: string; entityId?: string; assignedBy?: string;
    };
    const entityType = normalizeEntityType(body.entityType ?? "");
    const entityId = (body.entityId ?? "").trim();
    const assignedBy = (body.assignedBy ?? "Admin").trim() || "Admin";
    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
    }

    const project = await loadProject(tagId);
    if (!project || project.type !== "PROJECT") return new NextResponse(null, { status: 404 });

    const assignment = await prisma.tagAssignment.upsert({
      where: { tagId_entityType_entityId: { tagId, entityType, entityId } },
      create: { tagId, entityType, entityId, assignedBy },
      update: {},
    });
    return NextResponse.json({ success: true, assignment }, { status: 201 });
  } catch (error) {
    console.error(`POST /api/projects/${tagId}/items failed:`, error);
    return NextResponse.json({ error: "Failed to assign item" }, { status: 500 });
  }
}

// DELETE /api/projects/[tagId]/items
// Body: { entityType, entityId }  — remove an assignment
export async function DELETE(request: NextRequest, context: RouteContext) {
  const tagId = await getTagId(context);
  try {
    const body = (await request.json().catch(() => ({}))) as { entityType?: string; entityId?: string };
    const entityType = normalizeEntityType(body.entityType ?? "");
    const entityId = (body.entityId ?? "").trim();
    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
    }

    await prisma.tagAssignment.deleteMany({ where: { tagId, entityType, entityId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/projects/${tagId}/items failed:`, error);
    return NextResponse.json({ error: "Failed to unassign item" }, { status: 500 });
  }
}
