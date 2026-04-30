import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(req: NextRequest, ctx: Context) {
  const { id } = await ctx.params;
  const user   = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const body  = await req.json();
    const stock = await prisma.proteinStock.findUnique({ where: { id }, select: { owner: true } });
    if (!stock) return NextResponse.json({ error: "Protein stock not found" }, { status: 404 });
    if (stock.owner && stock.owner !== user && user !== "Admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await prisma.proteinStock.update({
      where: { id },
      data: { useParentThreshold: Boolean(body.useParentThreshold) },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH protein stock threshold-mode failed:", error);
    return NextResponse.json({ error: "Failed to update threshold mode" }, { status: 500 });
  }
}
