import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const reagent = await prisma.inventoryReagent.findUnique({
    where: { id: params.id },
    include: {
      researchNotes: { orderBy: { createdAt: "desc" } },
      usageEvents: { orderBy: { date: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!reagent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(reagent);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json();
  const reagent = await prisma.inventoryReagent.update({ where: { id: params.id }, data });
  return NextResponse.json(reagent);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.inventoryReagent.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
