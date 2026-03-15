import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { capitalizeTag } from "@/utils/capitalizeTag";
import { TagType } from "@prisma/client";

// GET /api/tags?q=searchterm
// Returns all tags (or those matching q) ordered by name ascending
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const tags = await prisma.tag.findMany({
    where: q
      ? {
          name: {
            contains: q,
            mode: "insensitive",
          },
        }
      : undefined,
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      createdBy: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(tags);
}

// POST /api/tags
// Body: { name, type, color, createdBy }
// Returns { exists: boolean, tag }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    type: "PROJECT" | "GENERAL";
    color: string;
    createdBy: string;
  };

  const capitalizedName = capitalizeTag(body.name.trim());

  // Case-insensitive match check
  const existing = await prisma.tag.findFirst({
    where: {
      name: {
        equals: capitalizedName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      createdBy: true,
    },
  });

  if (existing) {
    return NextResponse.json({ exists: true, tag: existing });
  }

  const tag = await prisma.tag.create({
    data: {
      name: capitalizedName,
      type: body.type as TagType,
      color: body.color,
      createdBy: body.createdBy,
    },
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      createdBy: true,
    },
  });

  return NextResponse.json({ exists: false, tag }, { status: 201 });
}
