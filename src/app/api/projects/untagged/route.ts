import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/projects/untagged
// Returns counts of runs and entries that have no PROJECT-type tag assignment.
export async function GET() {
  try {
    const projectTags = await prisma.tag.findMany({
      where: { type: "PROJECT" },
      select: { id: true },
    });
    const projectTagIds = projectTags.map((t) => t.id);

    let taggedRunIds: string[] = [];
    let taggedEntryIds: string[] = [];

    if (projectTagIds.length > 0) {
      const assignments = await prisma.tagAssignment.findMany({
        where: { tagId: { in: projectTagIds } },
        select: { entityType: true, entityId: true },
      });
      taggedRunIds = [
        ...new Set(
          assignments.filter((a) => a.entityType === "RUN").map((a) => a.entityId)
        ),
      ];
      taggedEntryIds = [
        ...new Set(
          assignments.filter((a) => a.entityType === "ENTRY").map((a) => a.entityId)
        ),
      ];
    }

    const [untaggedRunCount, untaggedProtocolCount] = await Promise.all([
      prisma.protocolRun.count({
        where: taggedRunIds.length ? { id: { notIn: taggedRunIds } } : undefined,
      }),
      prisma.entry.count({
        where: taggedEntryIds.length ? { id: { notIn: taggedEntryIds } } : undefined,
      }),
    ]);

    return NextResponse.json({ untaggedRunCount, untaggedProtocolCount });
  } catch (error) {
    console.error("GET /api/projects/untagged failed:", error);
    return NextResponse.json({ error: "Failed to load untagged counts" }, { status: 500 });
  }
}
