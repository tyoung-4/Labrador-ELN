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
            { category: { contains: search, mode: "insensitive" as const } },
            { location: { contains: search, mode: "insensitive" as const } },
            { vendor: { contains: search, mode: "insensitive" as const } },
            { notes: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : { isArchived: false };
    const reagents = await prisma.inventoryReagent.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { researchNotes: true, usageEvents: true } },
      },
    });
    return NextResponse.json(reagents);
  } catch (error) {
    console.error("GET /api/inventory/reagents failed:", error);
    return NextResponse.json({ error: "Failed to load reagents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const reagent = await prisma.inventoryReagent.create({ data });
    return NextResponse.json(reagent, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory/reagents failed:", error);
    return NextResponse.json({ error: "Failed to create reagent" }, { status: 500 });
  }
}
