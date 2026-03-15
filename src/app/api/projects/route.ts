import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/projects
// Returns all PROJECT-type tags with aggregate stats, sorted by lastActivity desc.
export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      where: { type: "PROJECT" },
      select: { id: true, name: true, color: true, createdBy: true, createdAt: true },
    });

    const tagIds = tags.map((t) => t.id);

    const assignments = tagIds.length
      ? await prisma.tagAssignment.findMany({
          where: { tagId: { in: tagIds } },
          select: { tagId: true, entityType: true, assignedAt: true },
        })
      : [];

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
      if (!stats.lastActivity || a.assignedAt > stats.lastActivity) {
        stats.lastActivity = a.assignedAt;
      }
    }

    const result = tags
      .map((tag) => {
        const stats = statsMap.get(tag.id)!;
        return {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          createdBy: tag.createdBy,
          createdAt: tag.createdAt.toISOString(),
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/projects failed:", error);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}
