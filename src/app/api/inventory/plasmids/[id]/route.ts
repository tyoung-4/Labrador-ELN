import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json();
  const item = await prisma.plasmid.update({ where: { id: params.id }, data });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.plasmid.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
