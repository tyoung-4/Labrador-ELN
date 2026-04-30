import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(req: NextRequest, ctx: Context) {
  const { id } = await ctx.params;
  const data = await req.json();
  const item = await prisma.cellLine.update({ where: { id }, data });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, ctx: Context) {
  const { id } = await ctx.params;
  await prisma.cellLine.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
