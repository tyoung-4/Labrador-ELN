import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const { entryId } = await params;
  const links = await prisma.protocolInventoryLink.findMany({
    where: { entryId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(links);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const { entryId } = await params;
  const body = await req.json().catch(() => ({}));
  const { itemType, itemId, itemName, itemDetail = "", notes = "" } = body;
  if (!itemType || !itemId || !itemName) {
    return NextResponse.json({ error: "itemType, itemId, and itemName are required" }, { status: 400 });
  }
  const link = await prisma.protocolInventoryLink.create({
    data: { entryId, itemType, itemId, itemName, itemDetail, notes },
  });
  return NextResponse.json(link, { status: 201 });
}
