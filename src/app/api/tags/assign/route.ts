import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/tags/assign
// Body: { tagId, entityType, entityId, assignedBy }
// Upsert — idempotent
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    tagId: string;
    entityType: string;
    entityId: string;
    assignedBy: string;
  };

  const assignment = await prisma.tagAssignment.upsert({
    where: {
      tagId_entityType_entityId: {
        tagId: body.tagId,
        entityType: body.entityType,
        entityId: body.entityId,
      },
    },
    create: {
      tagId: body.tagId,
      entityType: body.entityType,
      entityId: body.entityId,
      assignedBy: body.assignedBy,
    },
    update: {},
    include: {
      tag: {
        select: { id: true, name: true, type: true, color: true },
      },
    },
  });

  return NextResponse.json({ success: true, assignment });
}

// DELETE /api/tags/assign
// Body: { tagId, entityType, entityId, requestedBy }
// Authorization: requestedBy must be the entity owner or "Admin"
export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as {
    tagId: string;
    entityType: string;
    entityId: string;
    requestedBy: string;
  };

  const { tagId, entityType, entityId, requestedBy } = body;

  // Resolve entity owner name
  let ownerName: string | null = null;

  if (entityType === "RUN") {
    const run = await prisma.protocolRun.findUnique({
      where: { id: entityId },
      include: { runner: { select: { name: true } } },
    });
    ownerName = run?.runner?.name ?? null;
  } else if (entityType === "ENTRY") {
    const entry = await prisma.entry.findUnique({
      where: { id: entityId },
      include: { author: { select: { name: true } } },
    });
    ownerName = entry?.author?.name ?? null;
  }

  // Authorization check
  const isAdmin = requestedBy === "Admin";
  const isOwner = ownerName !== null && requestedBy === ownerName;

  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { error: "Only the owner or Admin can remove tags" },
      { status: 403 }
    );
  }

  // Delete the assignment
  await prisma.tagAssignment.delete({
    where: {
      tagId_entityType_entityId: {
        tagId,
        entityType,
        entityId,
      },
    },
  });

  return NextResponse.json({ success: true });
}
