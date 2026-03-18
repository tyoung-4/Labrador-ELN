import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ tagId: string }> | { tagId: string } };

// GET /api/projects/[tagId]/search?q=searchterm
// Case-insensitive full-text search across all entities tagged to this project.
// Returns empty results for queries shorter than 2 characters.
export async function GET(request: NextRequest, context: RouteContext) {
  const { tagId } = await context.params;
  const q = new URL(request.url).searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ runs: [], protocols: [], inventory: [], knowledgeHub: [] });
  }

  try {
    // Get all entity IDs tagged to this project
    const assignments = await prisma.tagAssignment.findMany({
      where: { tagId },
      select: { entityType: true, entityId: true },
    });

    const runIds   = assignments.filter((a) => a.entityType === "RUN").map((a) => a.entityId);
    const entryIds = assignments.filter((a) => a.entityType === "ENTRY").map((a) => a.entityId);

    const [runs, protocols] = await Promise.all([
      // Search runs: title, runId, notes
      runIds.length
        ? prisma.protocolRun.findMany({
            where: {
              id: { in: runIds },
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { runId: { contains: q, mode: "insensitive" } },
                { notes: { contains: q, mode: "insensitive" } },
              ],
            },
            select: { id: true, title: true, runId: true, status: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : [],

      // Search entries (protocols): title, description, body
      entryIds.length
        ? prisma.entry.findMany({
            where: {
              id: { in: entryIds },
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              title: true,
              version: true,
              updatedAt: true,
              author: { select: { name: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 20,
          })
        : [],
    ]);

    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id,
        title: r.title,
        runId: r.runId ?? r.id,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      protocols: protocols.map((p) => ({
        id: p.id,
        title: p.title,
        version: `v${p.version}`,
        author: p.author?.name ?? "Unknown",
      })),
      inventory: [],
      knowledgeHub: [],
    });
  } catch (error) {
    console.error(`GET /api/projects/${tagId}/search failed:`, error);
    return NextResponse.json({ runs: [], protocols: [], inventory: [], knowledgeHub: [] });
  }
}
