import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ tagId: string }> | { tagId: string } };

async function getTagId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return resolved.tagId;
}

// GET /api/projects/[tagId]
// Returns full project detail: tag info, runs (with pass/fail/skip counts), protocols.
export async function GET(_request: NextRequest, context: RouteContext) {
  const tagId = await getTagId(context);
  try {
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
      select: { id: true, name: true, color: true, createdBy: true, createdAt: true, type: true },
    });

    if (!tag || tag.type !== "PROJECT") {
      return new NextResponse(null, { status: 404 });
    }

    const assignments = await prisma.tagAssignment.findMany({
      where: { tagId },
      select: { entityType: true, entityId: true },
    });

    const runIds = assignments.filter((a) => a.entityType === "RUN").map((a) => a.entityId);
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

    return NextResponse.json({
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        createdBy: tag.createdBy,
        createdAt: tag.createdAt.toISOString(),
      },
      runs: runs.map((r) => ({
        id: r.id,
        title: r.title,
        runId: r.runId ?? r.id,
        operator: r.operatorName || r.runner?.name || "Unknown",
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
    });
  } catch (error) {
    console.error(`GET /api/projects/${tagId} failed:`, error);
    return NextResponse.json({ error: "Failed to load project detail" }, { status: 500 });
  }
}
