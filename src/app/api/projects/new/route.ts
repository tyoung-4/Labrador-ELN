import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { capitalizeTag } from "@/utils/capitalizeTag";

// POST /api/projects/new
// Body: { name, color, description?, startDate?, memberUserIds, createdBy }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    color: string;
    description?: string;
    startDate?: string;
    memberUserIds: string[];
    createdBy: string;
  };

  // Validate required fields
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }
  if (!body.color) {
    return NextResponse.json({ error: "Project color is required" }, { status: 400 });
  }
  if (!body.createdBy) {
    return NextResponse.json({ error: "createdBy is required" }, { status: 400 });
  }

  const capitalizedName = capitalizeTag(body.name.trim());

  // Enforce cross-type uniqueness — name must be unique across all tags
  const existing = await prisma.tag.findFirst({
    where: { name: { equals: capitalizedName, mode: "insensitive" } },
    select: { id: true, name: true, type: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: `A tag named "${existing.name}" already exists`,
        conflictType: existing.type,
      },
      { status: 409 }
    );
  }

  // Create the PROJECT tag with metadata
  const tag = await prisma.tag.create({
    data: {
      name: capitalizedName,
      type: "PROJECT",
      color: body.color,
      createdBy: body.createdBy,
      description: body.description?.trim() || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
    },
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      createdBy: true,
      createdAt: true,
      description: true,
      startDate: true,
    },
  });

  // Resolve owner's userId from name
  const ownerUser = await prisma.user.findFirst({
    where: { name: { equals: body.createdBy, mode: "insensitive" } },
    select: { id: true },
  });

  // Build set of memberUserIds — always includes owner if found
  const memberIdSet = new Set<string>(body.memberUserIds ?? []);
  if (ownerUser) memberIdSet.add(ownerUser.id);

  // Create ProjectMember rows (skip non-existent user IDs gracefully)
  if (memberIdSet.size > 0) {
    const validUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(memberIdSet) } },
      select: { id: true },
    });
    const validIds = validUsers.map((u) => u.id);
    if (validIds.length > 0) {
      await prisma.projectMember.createMany({
        data: validIds.map((userId) => ({ tagId: tag.id, userId })),
        skipDuplicates: true,
      });
    }
  }

  // Return tag with members populated
  const tagWithMembers = await prisma.tag.findUnique({
    where: { id: tag.id },
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      createdBy: true,
      createdAt: true,
      description: true,
      startDate: true,
      members: {
        select: {
          userId: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({ success: true, tag: tagWithMembers }, { status: 201 });
}
