import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { backbone: { contains: search, mode: "insensitive" as const } }, { insert: { contains: search, mode: "insensitive" as const } }, { location: { contains: search, mode: "insensitive" as const } }] }
    : {};
  const items = await prisma.plasmid.findMany({ where, orderBy: { name: "asc" }, include: { _count: { select: { researchNotes: true } } } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const item = await prisma.plasmid.create({ data });
  return NextResponse.json(item, { status: 201 });
}
