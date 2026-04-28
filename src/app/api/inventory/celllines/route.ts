import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const where = search
      ? {
          isArchived: false,
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { species: { contains: search, mode: "insensitive" as const } },
            { tissue: { contains: search, mode: "insensitive" as const } },
            { notes: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : { isArchived: false };
    const items = await prisma.cellLine.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { researchNotes: true } } },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/inventory/celllines failed:", error);
    return NextResponse.json({ error: "Failed to load cell lines" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const item = await prisma.cellLine.create({ data });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory/celllines failed:", error);
    return NextResponse.json({ error: "Failed to create cell line" }, { status: 500 });
  }
}
