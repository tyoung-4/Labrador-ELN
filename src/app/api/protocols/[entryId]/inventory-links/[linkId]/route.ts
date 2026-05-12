import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ entryId: string; linkId: string }> },
) {
  const { entryId, linkId } = await params;
  const link = await prisma.protocolInventoryLink.findUnique({ where: { id: linkId } });
  if (!link || link.entryId !== entryId) {
    return new NextResponse(null, { status: 404 });
  }
  await prisma.protocolInventoryLink.delete({ where: { id: linkId } });
  return new NextResponse(null, { status: 204 });
}
