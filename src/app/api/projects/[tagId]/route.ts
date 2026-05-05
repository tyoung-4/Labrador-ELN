import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ tagId: string }> | { tagId: string } };

async function getTagId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return resolved.tagId;
}

// GET /api/projects/[tagId]
// Returns full project detail: tag info (with description, startDate, members),
// runs (with pass/fail/skip counts), protocols, and lastActivity timestamp.
export async function GET(_request: NextRequest, context: RouteContext) {
  const tagId = await getTagId(context);
  try {
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
      select: {
        id: true,
        name: true,
        color: true,
        type: true,
        createdBy: true,
        createdAt: true,
        description: true,
        startDate: true,
        shortTagId: true,
        members: {
          select: {
            id: true,
            addedAt: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { addedAt: "asc" },
        },
      },
    });

    if (!tag || tag.type !== "PROJECT") {
      return new NextResponse(null, { status: 404 });
    }

    // Collect items tagged with either the project tag or its short tag
    const tagIds = [tagId, ...(tag.shortTagId ? [tag.shortTagId] : [])];
    const assignments = await prisma.tagAssignment.findMany({
      where: { tagId: { in: tagIds } },
      select: { entityType: true, entityId: true, assignedAt: true },
    });

    const runIds  = assignments.filter((a) => a.entityType === "RUN").map((a) => a.entityId);
    const entryIds = assignments.filter((a) => a.entityType === "ENTRY").map((a) => a.entityId);

    const [runs, entries, stepResults] = await Promise.all([
      runIds.length
        ? prisma.protocolRun.findMany({
            where: { id: { in: runIds } },
            select: {
              id: true,
              title: true,
              runId: true,
              status: true,
              operatorName: true,
              createdAt: true,
              updatedAt: true,
              completedAt: true,
              runner: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
          })
        : [],
      entryIds.length
        ? prisma.entry.findMany({
            where: { id: { in: entryIds } },
            select: {
              id: true,
              title: true,
              version: true,
              updatedAt: true,
              author: { select: { name: true } },
            },
            orderBy: { updatedAt: "desc" },
          })
        : [],
      runIds.length
        ? prisma.stepResult.findMany({
            where: { runId: { in: runIds } },
            select: { runId: true, result: true },
          })
        : [],
    ]);

    // Build per-run pass/fail/skip counts
    const stepCountMap = new Map<string, { pass: number; fail: number; skip: number }>();
    for (const sr of stepResults) {
      const counts = stepCountMap.get(sr.runId) ?? { pass: 0, fail: 0, skip: 0 };
      if (sr.result === "PASSED") counts.pass++;
      else if (sr.result === "FAILED") counts.fail++;
      else if (sr.result === "SKIPPED") counts.skip++;
      stepCountMap.set(sr.runId, counts);
    }

    // Compute lastActivity = most recent of: assignments, run updatedAt, entry updatedAt
    const activityDates: Date[] = [
      ...assignments.map((a) => a.assignedAt),
      ...(runs as Array<{ updatedAt: Date }>).map((r) => r.updatedAt),
      ...entries.map((e) => e.updatedAt),
    ];
    const lastActivity =
      activityDates.length > 0
        ? new Date(Math.max(...activityDates.map((d) => d.getTime()))).toISOString()
        : null;

    return NextResponse.json({
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        createdBy: tag.createdBy,
        createdAt: tag.createdAt.toISOString(),
        description: tag.description ?? null,
        startDate: tag.startDate?.toISOString() ?? null,
        shortTagId: tag.shortTagId ?? null,
        members: tag.members.map((m) => ({
          id: m.id,
          addedAt: m.addedAt.toISOString(),
          user: { id: m.user.id, name: m.user.name },
        })),
      },
      runs: runs.map((r) => ({
        id: r.id,
        title: r.title,
        runId: r.runId ?? r.id,
        runner: { name: r.operatorName || r.runner?.name || "Unknown" },
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        status: r.status,
        passCount: stepCountMap.get(r.id)?.pass ?? 0,
        failCount: stepCountMap.get(r.id)?.fail ?? 0,
        skipCount: stepCountMap.get(r.id)?.skip ?? 0,
      })),
      protocols: entries.map((e) => ({
        id: e.id,
        title: e.title,
        version: `v${e.version}`,
        author: e.author?.name ?? "Unknown",
        updatedAt: e.updatedAt.toISOString(),
      })),
      lastActivity,
    });
  } catch (error) {
    console.error(`GET /api/projects/${tagId} failed:`, error);
    return NextResponse.json({ error: "Failed to load project detail" }, { status: 500 });
  }
}
