import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const events = await prisma.reagentUsageEvent.findMany({
    where: { reagentId: params.id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { amountUsed, usedBy, notes } = await req.json();
  if (!amountUsed || amountUsed <= 0) return NextResponse.json({ error: "amountUsed must be > 0" }, { status: 400 });
  if (!usedBy) return NextResponse.json({ error: "usedBy required" }, { status: 400 });

  const reagent = await prisma.inventoryReagent.findUnique({ where: { id: params.id } });
  if (!reagent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newQty = reagent.quantity !== null ? Math.max(0, reagent.quantity - amountUsed) : null;

  const [event] = await prisma.$transaction([
    prisma.reagentUsageEvent.create({
      data: { reagentId: params.id, amountUsed, usedBy, notes: notes ?? null },
    }),
    ...(newQty !== null
      ? [prisma.inventoryReagent.update({ where: { id: params.id }, data: { quantity: newQty } })]
      : []),
  ]);
  return NextResponse.json(event, { status: 201 });
}
