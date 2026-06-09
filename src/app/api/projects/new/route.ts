import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { capitalizeTag } from "@/utils/capitalizeTag";

// Canonical Labrador ELN user ids always follow the "{shortname}-user" pattern
// (finn-user, jake-user, admin-user, pb-user, marceline-user). Legacy/duplicate
// rows (UUIDs, "user-finn", @labrador.eln seeds) do not match this pattern.
const CANONICAL_ID_RE = /^[a-z]+-user$/;

const SHORT_TAG_RE = /^[A-Z0-9.\-]+$/;

// POST /api/projects/new
// Body: { name, color, description?, startDate?, memberUserIds, createdBy, shortTag? }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    color: string;
    description?: string;
    startDate?: string;
    memberUserIds: string[];
    createdBy: string;
    shortTag?: string;
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

  // Optional short tag — validate format up front (already sanitized client-side,
  // but re-validate defensively)
  const shortTag = body.shortTag?.trim() || undefined;
  if (shortTag && !SHORT_TAG_RE.test(shortTag)) {
    return NextResponse.json(
      { error: "Short tag may only contain letters, numbers, '.' and '-'" },
      { status: 400 }
    );
  }
  if (shortTag && shortTag.toLowerCase() === capitalizedName.toLowerCase()) {
    return NextResponse.json(
      { error: "Short tag cannot be the same as the project name" },
      { status: 400 }
    );
  }

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

  // If a short tag was provided, it must also be unique across all tags
  if (shortTag) {
    const shortTagExisting = await prisma.tag.findFirst({
      where: { name: { equals: shortTag, mode: "insensitive" } },
      select: { id: true, name: true, type: true },
    });
    if (shortTagExisting) {
      return NextResponse.json(
        {
          error: `A tag named "${shortTagExisting.name}" already exists`,
          conflictType: shortTagExisting.type,
        },
        { status: 409 }
      );
    }
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

  // Resolve owner's userId from name — prefer the canonical "{shortname}-user"
  // id when multiple User rows share the same name (avoids non-deterministic
  // UUID/legacy ids leaking into ProjectMember).
  const ownerCandidates = await prisma.user.findMany({
    where: { name: { equals: body.createdBy, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  const ownerUser =
    ownerCandidates.find((u) => CANONICAL_ID_RE.test(u.id)) ?? ownerCandidates[0] ?? null;

  // Build set of candidate memberUserIds — always includes owner if found
  const candidateIdSet = new Set<string>(body.memberUserIds ?? []);
  if (ownerUser) candidateIdSet.add(ownerUser.id);

  // Resolve + dedupe candidates by underlying person (name), preferring the
  // canonical "{shortname}-user" id for each person. This guards against the
  // same person being added twice under two different User.id rows.
  let validIds: string[] = [];
  if (candidateIdSet.size > 0) {
    const candidateUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(candidateIdSet) } },
      select: { id: true, name: true },
    });
    const byPerson = new Map<string, { id: string; name: string | null }>();
    for (const u of candidateUsers) {
      const key = (u.name ?? u.id).toLowerCase();
      const existingMember = byPerson.get(key);
      if (
        !existingMember ||
        (!CANONICAL_ID_RE.test(existingMember.id) && CANONICAL_ID_RE.test(u.id))
      ) {
        byPerson.set(key, u);
      }
    }
    validIds = Array.from(byPerson.values()).map((u) => u.id);
  }

  // Create ProjectMember rows
  if (validIds.length > 0) {
    await prisma.projectMember.createMany({
      data: validIds.map((userId) => ({ tagId: tag.id, userId })),
      skipDuplicates: true,
    });
  }

  // If a short tag was requested, create it as a linked PROJECT tag in the
  // same step (reuses the existing shortTagId self-relation — no second modal).
  if (shortTag) {
    const shortTagRecord = await prisma.tag.create({
      data: {
        name: shortTag,
        type: "PROJECT",
        color: body.color,
        createdBy: body.createdBy,
      },
      select: { id: true, name: true, color: true },
    });
    await prisma.tag.update({
      where: { id: tag.id },
      data: { shortTagId: shortTagRecord.id },
    });
  }

  // Return tag with members + short tag populated
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
      shortTagId: true,
      shortTag: { select: { id: true, name: true, color: true } },
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
