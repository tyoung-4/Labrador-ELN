import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_req: NextRequest, ctx: Context) {
  const { id } = await ctx.params;
  const reagent = await prisma.inventoryReagent.findUnique({
    where: { id },
    include: {
      researchNotes: { orderBy: { createdAt: "desc" } },
      usageEvents:   { orderBy: { date: "desc" } },
      attachments:   { orderBy: { createdAt: "desc" } },
    },
  });
  if (!reagent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(reagent);
}

export async function PATCH(req: NextRequest, ctx: Context) {
  const { id }   = await ctx.params;
  const data     = await req.json();
  const reagent  = await prisma.inventoryReagent.update({ where: { id }, data });
  return NextResponse.json(reagent);
}

export async function DELETE(_req: NextRequest, ctx: Context) {
  const { id } = await ctx.params;
  await prisma.inventoryReagent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
