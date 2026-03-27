import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/projects?currentUser=username
// Returns:
//   { projects: ProjectSummary[], untagged: { runCount: number; protocolCount: number } }
//
// lastActivity per project = most recent of:
//   TagAssignment.assignedAt, ProtocolRun.updatedAt, Entry.updatedAt
//
// untagged counts are scoped to currentUser (by name, case-insensitive).
// If currentUser param is absent returns untagged: { runCount: 0, protocolCount: 0 }.
export async function GET(request: NextRequest) {
  const currentUser = new URL(request.url).searchParams.get("currentUser") ?? "";

  try {
    // ── 1. Fetch all PROJECT tags with metadata + members ────────────────────
    const tags = await prisma.tag.findMany({
      where: { type: "PROJECT" },
      select: {
        id: true,
        name: true,
        color: true,
        createdBy: true,
        createdAt: true,
        description: true,
        startDate: true,
        members: {
          select: { user: { select: { id: true, name: true } } },
          orderBy: { addedAt: "asc" },
        },
      },
    });

    const tagIds = tags.map((t) => t.id);

    // ── 2. Fetch all tag assignments for these projects ─────────────────────
    const assignments = tagIds.length
      ? await prisma.tagAssignment.findMany({
          where: { tagId: { in: tagIds } },
          select: { tagId: true, entityType: true, entityId: true, assignedAt: true },
        })
      : [];

    // Collect all tagged run and entry IDs across all projects
    const allRunIds = [
      ...new Set(
        assignments.filter((a) => a.entityType === "RUN").map((a) => a.entityId)
      ),
    ];
    const allEntryIds = [
      ...new Set(
        assignments.filter((a) => a.entityType === "ENTRY").map((a) => a.entityId)
      ),
    ];

    // ── 3. Fetch run/entry updatedAt for lastActivity calculation ───────────
    const [runs, entries] = await Promise.all([
      allRunIds.length
        ? prisma.protocolRun.findMany({
            where: { id: { in: allRunIds } },
            select: { id: true, updatedAt: true },
          })
        : [],
      allEntryIds.length
        ? prisma.entry.findMany({
            where: { id: { in: allEntryIds } },
            select: { id: true, updatedAt: true },
          })
        : [],
    ]);

    const runUpdatedAt = new Map(runs.map((r) => [r.id, r.updatedAt]));
    const entryUpdatedAt = new Map(entries.map((e) => [e.id, e.updatedAt]));

    // ── 4. Build per-project stats ──────────────────────────────────────────
    type Stats = { runCount: number; protocolCount: number; lastActivity: Date | null };
    const statsMap = new Map<string, Stats>();
    for (const tag of tags) {
      statsMap.set(tag.id, { runCount: 0, protocolCount: 0, lastActivity: null });
    }

    for (const a of assignments) {
      const stats = statsMap.get(a.tagId);
      if (!stats) continue;

      if (a.entityType === "RUN") stats.runCount++;
      else if (a.entityType === "ENTRY") stats.protocolCount++;

      // Candidate dates for lastActivity: assignedAt + entity updatedAt
      const candidates: Date[] = [a.assignedAt];
      if (a.entityType === "RUN") {
        const upd = runUpdatedAt.get(a.entityId);
        if (upd) candidates.push(upd);
      } else if (a.entityType === "ENTRY") {
        const upd = entryUpdatedAt.get(a.entityId);
        if (upd) candidates.push(upd);
      }
      const latest = new Date(Math.max(...candidates.map((d) => d.getTime())));
      if (!stats.lastActivity || latest > stats.lastActivity) {
        stats.lastActivity = latest;
      }
    }

    // ── 5. Build sorted project list ─────────────────────────────────────────
    const projects = tags
      .map((tag) => {
        const stats = statsMap.get(tag.id)!;
        return {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          createdBy: tag.createdBy,
          createdAt: tag.createdAt.toISOString(),
          description: tag.description ?? null,
          startDate: tag.startDate?.toISOString() ?? null,
          members: tag.members.map((m) => ({
            user: { id: m.user.id, name: m.user.name },
          })),
          runCount: stats.runCount,
          protocolCount: stats.protocolCount,
          lastActivity: stats.lastActivity?.toISOString() ?? null,
        };
      })
      .sort((a, b) => {
        if (!a.lastActivity && !b.lastActivity) return 0;
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return b.lastActivity.localeCompare(a.lastActivity);
      });

    // ── 6. Untagged counts scoped to currentUser ─────────────────────────────
    let untagged = { runCount: 0, protocolCount: 0 };

    if (currentUser.trim()) {
      // Find all user DB rows matching this name (dual @local.eln + @labrador.eln)
      const matchingUsers = await prisma.user.findMany({
        where: { name: { equals: currentUser.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      const matchingUserIds = matchingUsers.map((u) => u.id);

      const [untaggedRunCount, untaggedProtocolCount] = await Promise.all([
        // Runs owned by this user with no PROJECT tag
        prisma.protocolRun.count({
          where: {
            OR: [
              ...(matchingUserIds.length ? [{ runnerId: { in: matchingUserIds } }] : []),
              { operatorName: { equals: currentUser.trim(), mode: "insensitive" } },
            ],
            ...(allRunIds.length ? { id: { notIn: allRunIds } } : {}),
          },
        }),
        // Entries authored by this user with no PROJECT tag
        prisma.entry.count({
          where: {
            ...(matchingUserIds.length
              ? { authorId: { in: matchingUserIds } }
              : { authorId: null }),
            ...(allEntryIds.length ? { id: { notIn: allEntryIds } } : {}),
          },
        }),
      ]);

      untagged = { runCount: untaggedRunCount, protocolCount: untaggedProtocolCount };
    }

    return NextResponse.json({ projects, untagged });
  } catch (error) {
    console.error("GET /api/projects failed:", error);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}
