import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { category: { contains: search, mode: "insensitive" as const } },
          { location: { contains: search, mode: "insensitive" as const } },
          { vendor: { contains: search, mode: "insensitive" as const } },
          { notes: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const reagents = await prisma.inventoryReagent.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { researchNotes: true, usageEvents: true } },
    },
  });
  return NextResponse.json(reagents);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const reagent = await prisma.inventoryReagent.create({ data });
  return NextResponse.json(reagent, { status: 201 });
}
