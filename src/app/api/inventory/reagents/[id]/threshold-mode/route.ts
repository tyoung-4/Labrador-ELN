import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(req: NextRequest, ctx: Context) {
  const { id } = await ctx.params;
  const user   = req.headers.get("x-user-name") ?? "Unknown";
  try {
    const body    = await req.json();
    const reagent = await prisma.inventoryReagent.findUnique({ where: { id }, select: { owner: true } });
    if (!reagent) return NextResponse.json({ error: "Reagent not found" }, { status: 404 });
    if (reagent.owner && reagent.owner !== user && user !== "Admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await prisma.inventoryReagent.update({
      where: { id },
      data: { useParentThreshold: Boolean(body.useParentThreshold) },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH reagent threshold-mode failed:", error);
    return NextResponse.json({ error: "Failed to update threshold mode" }, { status: 500 });
  }
}
