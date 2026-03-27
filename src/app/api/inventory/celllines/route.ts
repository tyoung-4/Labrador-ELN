import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { species: { contains: search, mode: "insensitive" as const } }, { tissue: { contains: search, mode: "insensitive" as const } }, { notes: { contains: search, mode: "insensitive" as const } }] }
    : {};
  const items = await prisma.cellLine.findMany({ where, orderBy: { name: "asc" }, include: { _count: { select: { researchNotes: true } } } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const item = await prisma.cellLine.create({ data });
  return NextResponse.json(item, { status: 201 });
}
