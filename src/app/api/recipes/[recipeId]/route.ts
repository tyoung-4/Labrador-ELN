import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ recipeId: string }> };

// GET /api/recipes/[recipeId]
export async function GET(_req: Request, { params }: Params) {
  const { recipeId } = await params;
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      components: { orderBy: { order: "asc" } },
      createdBy:  { select: { id: true, name: true } },
    },
  });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(recipe);
}

// PUT /api/recipes/[recipeId] — full replace (owner only)
export async function PUT(req: Request, { params }: Params) {
  const { recipeId } = await params;
  const body = await req.json();
  const { name, description = "", components = [], requesterId } = body;

  const existing = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById !== requesterId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Replace components: delete all, then re-create
  const recipe = await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      name,
      description,
      components: {
        deleteMany: {},
        create: (components as {
          reagentName: string;
          concentration?: number;
          unit?: string;
          notes?: string;
          order?: number;
        }[]).map((c, i) => ({
          reagentName:   c.reagentName,
          concentration: c.concentration ?? null,
          unit:          c.unit  ?? "",
          notes:         c.notes ?? "",
          order:         c.order ?? i,
        })),
      },
    },
    include: {
      components: { orderBy: { order: "asc" } },
      createdBy:  { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(recipe);
}

// DELETE /api/recipes/[recipeId] (owner only)
export async function DELETE(req: Request, { params }: Params) {
  const { recipeId } = await params;
  const { searchParams } = new URL(req.url);
  const requesterId = searchParams.get("requesterId");

  const existing = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById !== requesterId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.recipe.delete({ where: { id: recipeId } });
  return new NextResponse(null, { status: 204 });
}
